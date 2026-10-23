import { describe, it, expect } from "vitest";
import { buildReservationPrefill, toTimeSlotDay } from "./reservationPrefill";
import { parseReservationAnswer } from "./reservations";
import { DAY_KEYS } from "./schedules";

const CONF = {
  step: "step2026_0",
  fields: { finder: "fFinder", user: "fUser", activity: "fActivity", slots: "fSlots" },
};

describe("toTimeSlotDay", () => {
  it("capitalise la clé interne pour coller au format stocké", () => {
    expect(toTimeSlotDay("monday")).toBe("Monday");
    expect(toTimeSlotDay("sunday")).toBe("Sunday");
  });
});

describe("buildReservationPrefill", () => {
  it("pose l'équipement dans le finder et le verrouille", () => {
    const { defaultValues, lockedFields } = buildReservationPrefill(CONF, {
      resourceId: "poi1",
      resourceName: "Gymnase",
    });
    // La clé qu'une régression produirait réellement est la NON PRÉFIXÉE — c'est la confusion
    // contre laquelle le schéma met en garde. `fFinderNONE` n'est produit par aucun chemin :
    // l'assertion d'origine ne pouvait pas échouer.
    expect(defaultValues.step2026_0["step2026_0fFinder"]).toBeUndefined();
    expect(defaultValues.step2026_0["finderstep2026_0fFinder"]).toEqual({
      poi1: { id: "poi1", name: "Gymnase", type: "poi" },
    });
    expect(lockedFields).toEqual(["finderstep2026_0fFinder"]);
  });

  it("tolère un nom d'équipement absent", () => {
    const { defaultValues } = buildReservationPrefill(CONF, { resourceId: "poi1" });
    expect(defaultValues.step2026_0["finderstep2026_0fFinder"]).toEqual({
      poi1: { id: "poi1", name: "", type: "poi" },
    });
  });

  it("traduit le créneau au format de stockage legacy", () => {
    const { defaultValues } = buildReservationPrefill(CONF, {
      resourceId: "poi1",
      slot: { day: "thursday", startMinutes: 1020, endMinutes: 1140 },
    });
    expect(defaultValues.step2026_0["step2026_0fSlots"]).toEqual([
      { day: "Thursday", startHour: "17", startMinute: "00", endHour: "19", endMinute: "00" },
    ]);
  });

  it("zéro-padde les heures du matin et gère les demi-heures", () => {
    const { defaultValues } = buildReservationPrefill(CONF, {
      resourceId: "poi1",
      slot: { day: "monday", startMinutes: 510, endMinutes: 570 },
    });
    expect(defaultValues.step2026_0["step2026_0fSlots"]).toEqual([
      { day: "Monday", startHour: "08", startMinute: "30", endHour: "09", endMinute: "30" },
    ]);
  });

  it("n'écrit aucun créneau si aucun n'est choisi", () => {
    const { defaultValues } = buildReservationPrefill(CONF, { resourceId: "poi1" });
    expect(defaultValues.step2026_0["step2026_0fSlots"]).toBeUndefined();
  });
});

/**
 * Le seul contrat qui compte pour ce helper : ce qu'il ÉCRIT doit être relu à l'identique par la
 * grille. Les tests ci-dessus ne comparent qu'à des littéraux recopiés de l'implémentation — si
 * `parseSlot`/`normalizeDayKey` cessaient d'accepter les jours capitalisés, ou si la convention de
 * préfixe du finder changeait, ils resteraient verts pendant que la réservation créée depuis la
 * fiche cesserait d'apparaître dans la grille.
 */
describe("buildReservationPrefill ⇄ parseReservationAnswer (aller-retour)", () => {
  const CONF_LECTURE = {
    form: "form1",
    step: "step2026_0",
    fields: {
      finder: "fFinder",
      user: "fUser",
      activity: "fActivity",
      slots: "fSlots",
    },
  };

  it.each(DAY_KEYS)("un créneau écrit le %s est relu à l'identique", (day) => {
    const { defaultValues } = buildReservationPrefill(CONF, {
      resourceId: "poi1",
      resourceName: "Gymnase",
      slot: { day, startMinutes: 18 * 60, endMinutes: 19 * 60 + 30 },
    });

    // `parseReservationAnswer` prend le `serverData` NU (pas l'item de recherche qui l'enveloppe).
    const reservation = parseReservationAnswer(
      { id: "a1", answers: defaultValues },
      CONF_LECTURE as never,
    )!;

    expect(reservation.resourceIds).toEqual(["poi1"]);
    expect(reservation.slots).toHaveLength(1);
    expect(reservation.slots[0].day).toBe(day);
    expect(reservation.slots[0].startMinutes).toBe(18 * 60);
    expect(reservation.slots[0].endMinutes).toBe(19 * 60 + 30);
  });
});

describe("buildReservationPrefill — période choisie (`reservations.periods`)", () => {
  const AVEC_DATES = { ...CONF, fields: { ...CONF.fields, periodStart: "fStart", periodEnd: "fEnd" } };

  it("pose Date début / Date fin de la RÉSERVATION, pas sur le créneau cliqué", () => {
    const { defaultValues } = buildReservationPrefill(AVEC_DATES, {
      resourceId: "poi1",
      slot: { day: "monday", startMinutes: 1080, endMinutes: 1140 },
      period: { periodStart: "2026-10-01", periodEnd: "2026-12-18" },
    });
    expect(defaultValues.step2026_0["step2026_0fStart"]).toBe("2026-10-01");
    expect(defaultValues.step2026_0["step2026_0fEnd"]).toBe("2026-12-18");
    const [creneau] = defaultValues.step2026_0["step2026_0fSlots"] as Array<Record<string, unknown>>;
    expect(creneau.periodStart).toBeUndefined();
    // Aller-retour : la réservation relue porte la période choisie.
    const relue = parseReservationAnswer({ answers: defaultValues }, AVEC_DATES)!;
    expect(relue).toMatchObject({ periodStart: "2026-10-01", periodEnd: "2026-12-18" });
  });

  it("laisse à saisir une borne absente", () => {
    const { defaultValues } = buildReservationPrefill(AVEC_DATES, {
      resourceId: "poi1",
      period: { periodStart: "2026-10-23" },
    });
    expect(defaultValues.step2026_0["step2026_0fStart"]).toBe("2026-10-23");
    expect(defaultValues.step2026_0).not.toHaveProperty("step2026_0fEnd");
  });

  it("n'écrit aucune date quand la config ne mappe pas les champs de période", () => {
    const { defaultValues } = buildReservationPrefill(CONF, {
      resourceId: "poi1",
      period: { periodStart: "2026-10-01", periodEnd: "2026-12-18" },
    });
    expect(Object.keys(defaultValues.step2026_0)).toEqual(["finderstep2026_0fFinder"]);
  });
});
