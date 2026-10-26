import { describe, it, expect } from "vitest";
import type { SearchByFieldValue } from "../contexts/pageFilters";
import type { Reservation, ReservationSlot } from "./reservations";
import { DAY_KEYS } from "./schedules";
import { EXCLUDE_TYPE } from "./searchByFieldsToQuery";
import {
  activeSlotParam,
  amplitudeLabels,
  busyResourceIds,
  dayKeyOf,
  describeSlot,
  formatSlotDays,
  hourMinutes,
  isIsoDay,
  joinTime,
  localIsoDay,
  minuteOptions,
  resolveSlotRange,
  shortDayLabel,
  SLOT_HOURS,
  SLOT_QUARTERS,
  slotFromParam,
  slotIssue,
  slotToParam,
  splitTime,
  withSlotEntry,
  type SlotWindow,
} from "./slotFilter";

const A = "6a0b3078f16441794857e2f0";
const B = "6a0b3078f16441794857e2f1";
const C = "6a0b3078f16441794857e2f2";
const D = "6a0b3078f16441794857e2f3";
const E = "6a0b3078f16441794857e2f4";

// Un mardi : les cas « sans période » se lisent à partir de ce jour.
const today = "2026-10-20";

const slot = (day: ReservationSlot["day"], start: string, end: string): ReservationSlot => {
  const minutes = (h: string) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3));
  return { day, start, end, startMinutes: minutes(start), endMinutes: minutes(end) };
};

const reservation = (
  id: string,
  resourceIds: string[],
  slots: ReservationSlot[],
  periodStart?: string,
  periodEnd?: string,
): Reservation => ({
  id,
  resources: resourceIds.map((r) => ({ id: r })),
  resourceIds,
  user: "Club",
  slots,
  periodStart,
  periodEnd,
});

const JOURS: Record<string, string> = {
  "days.monday": "Lundi",
  "days.tuesday": "Mardi",
  "days.wednesday": "Mercredi",
  "days.thursday": "Jeudi",
  "days.friday": "Vendredi",
  "days.saturday": "Samedi",
  "days.sunday": "Dimanche",
  "SlotFilter.everyDay": "Tous les jours",
};
const t: Parameters<typeof formatSlotDays>[1] = (key) => (typeof key === "string" ? (JOURS[key] ?? key) : "");

describe("slotFilter — jours et dates", () => {
  it("isIsoDay n'accepte qu'un jour calendaire réel", () => {
    expect(isIsoDay("2026-10-26")).toBe(true);
    expect(isIsoDay("2028-02-29")).toBe(true);
    expect(isIsoDay("2026-02-30")).toBe(false);
    expect(isIsoDay("2026-13-01")).toBe(false);
    expect(isIsoDay("2026-1-1")).toBe(false);
    expect(isIsoDay(undefined)).toBe(false);
  });

  it("dayKeyOf donne la clé de jour des créneaux (lundi en tête)", () => {
    expect(dayKeyOf("2026-10-26")).toBe("monday");
    expect(dayKeyOf("2026-10-29")).toBe("thursday");
    expect(dayKeyOf("2026-11-01")).toBe("sunday");
  });

  it("localIsoDay lit la date LOCALE, pas la date UTC", () => {
    expect(localIsoDay(new Date(2026, 9, 5, 1, 30))).toBe("2026-10-05");
    expect(localIsoDay(new Date(2026, 0, 31, 23, 59))).toBe("2026-01-31");
  });
});

describe("slotFilter — heures au quart d'heure", () => {
  it("SLOT_HOURS propose les 24 heures, SLOT_QUARTERS les quarts d'heure", () => {
    expect(SLOT_HOURS).toHaveLength(24);
    expect([SLOT_HOURS[0], SLOT_HOURS[23]]).toEqual(["00", "23"]);
    expect(SLOT_QUARTERS).toEqual(["00", "15", "30", "45"]);
  });

  it("splitTime / joinTime : aller-retour, minute 00 par défaut, pas de borne sans heure", () => {
    expect(splitTime("07:45")).toEqual({ hour: "07", minute: "45" });
    expect(splitTime(undefined)).toEqual({ hour: "", minute: "" });
    expect(splitTime("25:00")).toEqual({ hour: "", minute: "" });
    expect(joinTime("07", "45")).toBe("07:45");
    expect(joinTime("18", "")).toBe("18:00");
    expect(joinTime("", "30")).toBeUndefined();
  });

  it("hourMinutes lit un champ heure, null s'il est vide ou invalide", () => {
    expect(hourMinutes("07:35")).toBe(455);
    expect(hourMinutes("")).toBeNull();
    expect(hourMinutes("24:00")).toBeNull();
    expect(hourMinutes(undefined)).toBeNull();
  });

  it("minuteOptions garde la minute d'un ancien lien sans la réécrire", () => {
    expect(minuteOptions()).toEqual(["00", "15", "30", "45"]);
    expect(minuteOptions("30")).toEqual(["00", "15", "30", "45"]);
    expect(minuteOptions("10")).toEqual(["00", "10", "15", "30", "45"]);
    expect(minuteOptions("xx")).toEqual(["00", "15", "30", "45"]);
  });
});

describe("slotFilter — valeur d'URL", () => {
  it("aller-retour pour chaque forme de créneau", () => {
    const formes: [SlotWindow, string][] = [
      [{ days: ["monday", "thursday"], start: "15:00", end: "18:00" }, "monday.thursday_15h00-18h00"],
      [{ start: "18:00", end: "20:00" }, "_18h00-20h00"],
      [{ days: ["monday"], start: "15:00" }, "monday_15h00-"],
      [{ end: "09:00" }, "_-09h00"],
      [{ days: ["monday"] }, "monday"],
      [
        { days: ["monday", "thursday"], start: "15:00", end: "18:00", periodStart: "2026-08-17", periodEnd: "2027-08-12" },
        "monday.thursday_15h00-18h00_2026-08-17-2027-08-12",
      ],
      [{ days: ["saturday"], periodStart: "2026-11-14" }, "saturday__2026-11-14-"],
      [{ periodEnd: "2027-08-12" }, "__-2027-08-12"],
    ];
    for (const [forme, param] of formes) {
      expect(slotToParam(forme)).toBe(param);
      expect(slotFromParam(param)).toEqual(forme);
    }
  });

  it("jours rangés dans l'ordre de la semaine, sans doublon : une sélection, une valeur", () => {
    expect(slotToParam({ days: ["thursday", "monday", "thursday"] })).toBe("monday.thursday");
    expect(slotFromParam("thursday.monday.thursday")).toEqual({ days: ["monday", "thursday"] });
  });

  it("rien de choisi → null (le param est supprimé), partie invalide omise", () => {
    expect(slotToParam({})).toBeNull();
    expect(slotToParam({ days: [] })).toBeNull();
    expect(slotToParam({ start: "25:00" })).toBeNull();
    expect(slotToParam({ days: ["monday"], periodEnd: "2026-02-30" })).toBe("monday");
  });

  it("une valeur mal formée ne filtre rien", () => {
    const abimees = [
      "", null, undefined, "abc", "Monday", "monday,thursday_15h00-18h00", "_25h00-", "_18:00-20:00",
      "__2026-02-30-", "monday_2026-08-17-", "_-",
      // Ancien format (un jour daté) : jamais publié, ignoré comme un lien abîmé.
      "2026-10-26_18h00-20h00",
    ];
    for (const raw of abimees) expect(slotFromParam(raw)).toBeNull();
    // Séparateurs sans valeur : les jours seuls restent valables.
    expect(slotFromParam("monday_")).toEqual({ days: ["monday"] });
    expect(slotFromParam("monday_-_-")).toEqual({ days: ["monday"] });
  });
});

describe("slotFilter — règles du créneau", () => {
  it("jours et heures → ces jours, cette plage, à partir d'aujourd'hui sans limite", () => {
    expect(resolveSlotRange({ days: ["thursday", "monday"], start: "15:00", end: "18:00" }, today)).toEqual({
      days: ["monday", "thursday"],
      startMinutes: 15 * 60,
      endMinutes: 18 * 60,
      periodStart: today,
    });
  });

  it("aucun jour → les 7", () => {
    expect(resolveSlotRange({ start: "18:00", end: "20:00" }, today)?.days).toEqual([...DAY_KEYS]);
    expect(resolveSlotRange({ days: [], start: "18:00" }, today)?.days).toEqual([...DAY_KEYS]);
  });

  it("début seul → jusqu'à la fin de l'amplitude ; fin seule → depuis son début ; jours seuls → toute l'amplitude", () => {
    expect(resolveSlotRange({ days: ["monday"], start: "14:00" }, today)).toMatchObject({ startMinutes: 840, endMinutes: 1320 });
    expect(resolveSlotRange({ end: "16:00" }, today)).toMatchObject({ startMinutes: 480, endMinutes: 960 });
    expect(resolveSlotRange({ days: ["monday"] }, today)).toMatchObject({ startMinutes: 480, endMinutes: 1320 });
  });

  it("une borne hors amplitude l'emporte : jamais de plage vide ou inversée", () => {
    expect(resolveSlotRange({ start: "22:30" }, today)).toMatchObject({ startMinutes: 1350, endMinutes: 1440 });
    expect(resolveSlotRange({ end: "07:00" }, today)).toMatchObject({ startMinutes: 0, endMinutes: 420 });
  });

  it("amplitude de la config", () => {
    const amplitude = { startHour: 9, endHour: 18 };
    expect(resolveSlotRange({ start: "14:00" }, today, amplitude)).toMatchObject({ endMinutes: 18 * 60 });
    expect(amplitudeLabels(amplitude)).toEqual({ open: "09:00", close: "18:00" });
    expect(amplitudeLabels()).toEqual({ open: "08:00", close: "22:00" });
  });

  it("période saisie : bornes reprises ; début absent → aujourd'hui ; fin absente → sans limite", () => {
    const saison = { periodStart: "2026-08-17", periodEnd: "2027-08-12" };
    expect(resolveSlotRange({ days: ["monday"], ...saison }, today)).toMatchObject(saison);
    expect(resolveSlotRange({ periodEnd: "2027-08-12" }, today)).toMatchObject({ periodStart: today, periodEnd: "2027-08-12" });
    expect(resolveSlotRange({ periodStart: "2026-11-02" }, today)?.periodEnd).toBeUndefined();
  });

  it("période de moins d'une semaine → seuls les jours qu'elle contient", () => {
    const jours = (s: SlotWindow) => resolveSlotRange(s, today)?.days;
    expect(jours({ periodStart: "2026-11-14", periodEnd: "2026-11-14" })).toEqual(["saturday"]);
    expect(jours({ periodStart: "2026-10-26", periodEnd: "2026-10-28" })).toEqual(["monday", "tuesday", "wednesday"]);
    // À cheval sur deux semaines : rangés lundi → dimanche.
    expect(jours({ periodStart: "2026-10-31", periodEnd: "2026-11-02" })).toEqual(["monday", "saturday", "sunday"]);
    expect(jours({ days: ["thursday", "monday"], periodStart: "2026-10-26", periodEnd: "2026-10-28" })).toEqual(["monday"]);
    // Une semaine pleine contient tous les jours.
    expect(jours({ periodStart: "2026-10-26", periodEnd: "2026-11-01" })).toEqual([...DAY_KEYS]);
    // Fin seule, proche : de aujourd'hui (mardi) à jeudi.
    expect(jours({ periodEnd: "2026-10-22" })).toEqual(["tuesday", "wednesday", "thursday"]);
  });

  it("saisie incohérente → le motif, et aucun créneau", () => {
    const cas: [SlotWindow, ReturnType<typeof slotIssue>][] = [
      [{ start: "16:00", end: "14:00" }, "hours"],
      [{ start: "16:00", end: "16:00" }, "hours"],
      [{ periodStart: "2026-11-02", periodEnd: "2026-11-01" }, "period"],
      // Fin seule déjà passée : la période commencerait après elle.
      [{ periodEnd: "2026-10-19" }, "period"],
      [{ days: ["thursday"], periodStart: "2026-11-14", periodEnd: "2026-11-14" }, "days"],
      [{ days: ["monday"], start: "14:00", end: "16:00" }, null],
      [{ periodStart: "2026-11-14", periodEnd: "2026-11-14" }, null],
    ];
    for (const [saisie, motif] of cas) {
      expect(slotIssue(saisie, today)).toBe(motif);
      expect(resolveSlotRange(saisie, today) === null).toBe(motif !== null);
    }
  });

  it("describeSlot affiche la plage et les jours RÉSOLUS, la période SAISIE seulement", () => {
    expect(describeSlot({ days: ["monday"], start: "14:00" }, today)).toEqual({ days: ["monday"], start: "14:00", end: "22:00" });
    expect(describeSlot({ start: "09:00", end: "17:00", periodStart: "2026-11-14", periodEnd: "2026-11-14" }, today)).toEqual({
      days: ["saturday"],
      start: "09:00",
      end: "17:00",
      periodStart: "2026-11-14",
      periodEnd: "2026-11-14",
    });
    expect(describeSlot({ start: "16:00", end: "14:00" }, today)).toBeNull();
  });
});

describe("slotFilter — libellés des jours", () => {
  it("abrégé tiré du nom du jour", () => {
    expect(shortDayLabel("monday", t)).toBe("Lun");
    expect(shortDayLabel("wednesday", t)).toBe("Mer");
    expect(shortDayLabel("monday", () => "Monday")).toBe("Mon");
  });

  it("« Lun, Jeu », ou « Tous les jours » pour les 7", () => {
    expect(formatSlotDays(["monday", "thursday"], t)).toBe("Lun, Jeu");
    expect(formatSlotDays(["saturday"], t)).toBe("Sam");
    expect(formatSlotDays(DAY_KEYS, t)).toBe("Tous les jours");
  });
});

describe("slotFilter — ressources occupées", () => {
  const saison = ["2026-08-17", "2027-08-12"] as const;
  const reservations = [
    reservation("r1", [A], [slot("monday", "18:00", "20:30")], ...saison),
    reservation("r2", [C, B], [slot("thursday", "18:15", "19:15")], ...saison),
    // Saison terminée : ne gêne plus une recherche sans période.
    reservation("r3", [D], [slot("monday", "18:00", "20:00")], "2025-09-01", "2026-06-30"),
    // Identifiant malformé : jamais envoyé au backend.
    reservation("r4", ["pas-un-id"], [slot("monday", "18:00", "20:00")], ...saison),
    // À venir : gêne déjà, la recherche valant pour chaque semaine à partir d'aujourd'hui.
    reservation("r5", [E], [slot("tuesday", "18:00", "19:00")], "2027-01-04", "2027-06-30"),
  ];
  const occupees = (s: SlotWindow, list: Reservation[] = reservations) => {
    const range = resolveSlotRange(s, today);
    if (!range) throw new Error(`créneau incohérent : ${JSON.stringify(s)}`);
    return busyResourceIds(list, range);
  };

  it("retire les ressources d'une réservation en cours qui chevauche le créneau ; la terminée ne gêne plus", () => {
    expect(occupees({ days: ["monday"], start: "18:00", end: "20:00" })).toEqual([A]);
    expect(occupees({ days: ["monday"], start: "20:00", end: "21:00" })).toEqual([A]);
  });

  it("plusieurs jours : libre CHACUN d'eux", () => {
    expect(occupees({ days: ["monday"], start: "18:30", end: "19:00" })).toEqual([A]);
    expect(occupees({ days: ["thursday"], start: "18:30", end: "19:00" })).toEqual([B, C]);
    expect(occupees({ days: ["monday", "thursday"], start: "18:30", end: "19:00" })).toEqual([A, B, C]);
  });

  it("aucun jour : libre tous les jours de la semaine", () => {
    expect(occupees({ start: "18:00", end: "19:00" })).toEqual([A, B, C, E]);
  });

  it("créneaux semi-ouverts : 18 h–20 h 30 ne gêne pas 20 h 30–22 h", () => {
    expect(occupees({ days: ["monday"], start: "20:30", end: "22:00" })).toEqual([]);
  });

  it("la période décide : une réservation à venir gêne, sauf si la période s'achève avant elle", () => {
    expect(occupees({ days: ["tuesday"], start: "18:00", end: "19:00" })).toEqual([E]);
    expect(occupees({ days: ["tuesday"], start: "18:00", end: "19:00", periodEnd: "2026-12-31" })).toEqual([]);
    // Une période passée saisie à la main : la saison terminée y compte.
    expect(occupees({ days: ["monday"], start: "18:00", end: "20:00", periodStart: "2026-03-01", periodEnd: "2026-06-30" })).toEqual([D]);
  });

  it("la période d'un créneau prime sur celle de sa réservation : un cycle terminé ne gêne plus", () => {
    // Réservation de saison dont le créneau du lundi n'occupait que le 1er cycle, achevé le 2026-10-16.
    const cycle = reservation("r7", [D], [{ ...slot("monday", "08:00", "10:00"), periodEnd: "2026-10-16" }], ...saison);
    expect(occupees({ days: ["monday"], start: "08:00", end: "09:00" }, [cycle])).toEqual([]);
    expect(occupees({ days: ["monday"], start: "08:00", end: "09:00", periodStart: "2026-10-12" }, [cycle])).toEqual([D]);
  });

  it("une réservation sur plusieurs ressources les occupe toutes — triées, sans doublon", () => {
    const doublon = [...reservations, reservation("r6", [B], [slot("thursday", "19:00", "20:00")], ...saison)];
    expect(occupees({ days: ["thursday"], start: "19:00", end: "19:30" }, doublon)).toEqual([B, C]);
  });
});

describe("slotFilter — état partagé", () => {
  const autre: SearchByFieldValue = { field: "equip_type_name", value: ["Gymnase"] };

  it("publie le créneau sous `${id}:${valeur d'URL}`, en exclusion sur `_id`", () => {
    const next = withSlotEntry({ "type:gym": autre }, "creneau", "monday.thursday_15h00-18h00", [A]);
    expect(next).toEqual({
      "type:gym": autre,
      "creneau:monday.thursday_15h00-18h00": { field: "_id", type: EXCLUDE_TYPE, value: [A] },
    });
    expect(activeSlotParam(next, "creneau")).toBe("monday.thursday_15h00-18h00");
    expect(activeSlotParam(next, "autre")).toBeNull();
  });

  it("rend l'état LUI-MÊME quand rien ne change", () => {
    const prev = withSlotEntry({}, "creneau", "monday", [A, B]);
    expect(withSlotEntry(prev, "creneau", "monday", [A, B])).toBe(prev);
    const vide = { "type:gym": autre };
    expect(withSlotEntry(vide, "creneau", null, [])).toBe(vide);
  });

  it("remplace le créneau précédent, ou le retire sans toucher aux autres filtres", () => {
    const prev = withSlotEntry({ "type:gym": autre }, "creneau", "monday", [A]);
    const remplace = withSlotEntry(prev, "creneau", "_18h00-20h00", []);
    expect(Object.keys(remplace)).toEqual(["type:gym", "creneau:_18h00-20h00"]);
    expect(withSlotEntry(remplace, "creneau", null, [])).toEqual({ "type:gym": autre });
  });
});
