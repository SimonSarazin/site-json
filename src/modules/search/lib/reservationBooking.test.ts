import { describe, it, expect } from "vitest";
import type { Reservation, ReservationSlot } from "./reservations";
import {
  bookingIssue,
  bookingIssueMessage,
  isSameSlot,
  resolvePeriodFilter,
  slotHoursIssue,
  slotIssues,
} from "./reservationBooking";

const today = "2026-10-23";

const slot = (
  day: ReservationSlot["day"],
  start: string,
  end: string,
  period: Partial<Pick<ReservationSlot, "periodStart" | "periodEnd">> = {},
): ReservationSlot => {
  const minutes = (h: string) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3));
  return { day, start, end, startMinutes: minutes(start), endMinutes: minutes(end), ...period };
};

const reservation = (
  id: string,
  slots: ReservationSlot[],
  periodStart?: string,
  periodEnd?: string,
  user = "CLUB A",
): Reservation => ({ id, resources: [{ id: "poi1" }], resourceIds: ["poi1"], user, slots, periodStart, periodEnd });

/** Traduction factice : la clé et ses paramètres, pour vérifier QUOI est dit sans figer la phrase. */
const t = ((key: string, _fallback?: string, params?: Record<string, unknown>) =>
  params ? `${key} ${JSON.stringify(params)}` : key) as Parameters<typeof bookingIssueMessage>[1];

describe("resolvePeriodFilter", () => {
  it("sans date : à partir d'aujourd'hui, sans limite", () => {
    expect(resolvePeriodFilter("", "", today)).toEqual({ periodStart: today, periodEnd: undefined });
  });

  it("reprend les dates choisies, une fin seule partant d'aujourd'hui", () => {
    expect(resolvePeriodFilter("2026-10-01", "2026-12-31", today)).toEqual({
      periodStart: "2026-10-01",
      periodEnd: "2026-12-31",
    });
    expect(resolvePeriodFilter("", "2026-12-31", today)).toEqual({ periodStart: today, periodEnd: "2026-12-31" });
  });

  it("refuse une fin avant le début, même implicite (aujourd'hui)", () => {
    expect(resolvePeriodFilter("2026-12-01", "2026-11-30", today)).toBeNull();
    expect(resolvePeriodFilter("", "2026-08-14", today)).toBeNull();
  });
});

describe("bookingIssue", () => {
  // Août–septembre occupé le lundi 17 h–19 h ; la nouvelle réservation vise octobre–décembre.
  const aout = reservation("aout", [slot("monday", "17:00", "19:00")], "2026-08-17", "2026-09-30");

  it("laisse passer le même horaire sur une autre période", () => {
    const nouvelle = reservation("", [slot("monday", "17:00", "19:00")], "2026-10-01", "2026-12-18");
    expect(bookingIssue(nouvelle, [aout])).toBeNull();
  });

  it("refuse une réservation sans période complète ou à l'envers", () => {
    const creneaux = [slot("monday", "17:00", "19:00")];
    expect(bookingIssue(reservation("", creneaux, "2026-10-01"), [])).toEqual({ kind: "period" });
    expect(bookingIssue(reservation("", creneaux, undefined, "2026-12-18"), [])).toEqual({ kind: "period" });
    expect(bookingIssue(reservation("", creneaux, "2026-12-18", "2026-10-01"), [])).toEqual({ kind: "period" });
  });

  it("refuse la période d'un créneau à l'envers ou hors de la réservation", () => {
    const inverse = slot("monday", "17:00", "19:00", { periodStart: "2026-11-30", periodEnd: "2026-11-01" });
    expect(bookingIssue(reservation("", [inverse], "2026-10-01", "2026-12-18"), [])).toEqual({
      kind: "slotPeriod",
      slot: inverse,
    });
    const deborde = slot("monday", "17:00", "19:00", { periodEnd: "2027-01-15" });
    expect(bookingIssue(reservation("", [deborde], "2026-10-01", "2026-12-18"), [])?.kind).toBe("slotPeriod");
  });

  it("refuse deux créneaux du formulaire qui se chevauchent sur une période commune", () => {
    const a = slot("monday", "17:00", "19:00", { periodEnd: "2026-11-15" });
    const b = slot("monday", "18:00", "20:00", { periodStart: "2026-11-15" });
    expect(bookingIssue(reservation("", [a, b], "2026-10-01", "2026-12-18"), [])).toEqual({ kind: "overlap", slot: b });
  });

  it("accepte deux cycles successifs du même créneau dans la même réservation", () => {
    const cycle1 = slot("monday", "17:00", "19:00", { periodEnd: "2026-11-14" });
    const cycle2 = slot("monday", "17:00", "19:00", { periodStart: "2026-11-15" });
    expect(bookingIssue(reservation("", [cycle1, cycle2], "2026-10-01", "2026-12-18"), [])).toBeNull();
  });

  it("refuse un créneau déjà réservé sur une période commune, et nomme l'occupant", () => {
    const nouvelle = reservation("", [slot("monday", "18:00", "20:00")], "2026-09-15", "2026-12-18");
    const issue = bookingIssue(nouvelle, [aout]);
    expect(issue).toEqual({ kind: "taken", slot: nouvelle.slots[0], by: aout, bySlot: aout.slots[0] });
  });

  it("juge l'occupation sur la période du CRÉNEAU existant, pas sur celle de sa saison", () => {
    const saison = reservation(
      "saison",
      [slot("monday", "17:00", "19:00", { periodEnd: "2026-09-30" })],
      "2026-08-17",
      "2027-07-02",
    );
    const nouvelle = reservation("", [slot("monday", "17:00", "19:00")], "2026-10-01", "2026-12-18");
    expect(bookingIssue(nouvelle, [saison])).toBeNull();
  });

  it("une réponse éditée ne se gêne pas elle-même", () => {
    const editee = reservation("aout", [slot("monday", "17:00", "19:00")], "2026-08-17", "2026-10-15");
    expect(bookingIssue(editee, [aout])).toBeNull();
  });
});

describe("slotIssues", () => {
  // JS SALINE occupe le mercredi 16 h 30 – 20 h 30 de septembre à décembre.
  const saline = reservation(
    "saline",
    [slot("wednesday", "16:30", "20:30")],
    "2026-09-01",
    "2026-12-31",
    "JS SALINE",
  );
  // Créneaux tels que les lit `parseReservationAnswer` : index BRUT du champ.
  const saisi = (index: number, day: ReservationSlot["day"], start: string, end: string): ReservationSlot => ({
    ...slot(day, start, end),
    index,
  });

  it("n'avertit de rien tant que la période de la réservation n'est pas complète", () => {
    const sansFin = reservation("", [saisi(0, "wednesday", "18:00", "19:00")], "2026-10-01");
    expect(slotIssues(sansFin, [saline]).size).toBe(0);
  });

  it("signale sous son index le créneau déjà réservé sur une période commune, avec l'occupant", () => {
    const nouvelle = reservation(
      "",
      [saisi(0, "monday", "18:00", "19:00"), saisi(1, "wednesday", "18:00", "19:00")],
      "2026-10-01",
      "2026-12-18",
    );
    const issues = slotIssues(nouvelle, [saline]);
    expect([...issues.keys()]).toEqual([1]);
    expect(issues.get(1)).toEqual({ kind: "taken", slot: nouvelle.slots[1], by: saline, bySlot: saline.slots[0] });
  });

  it("laisse libre le même horaire sur une période disjointe", () => {
    const janvier = reservation("", [saisi(0, "wednesday", "18:00", "19:00")], "2027-01-04", "2027-03-31");
    expect(slotIssues(janvier, [saline]).size).toBe(0);
  });

  it("signale le créneau qui chevauche un créneau plus haut du formulaire", () => {
    const nouvelle = reservation(
      "",
      [saisi(0, "monday", "17:00", "19:00"), saisi(1, "monday", "18:00", "20:00")],
      "2026-10-01",
      "2026-12-18",
    );
    expect(slotIssues(nouvelle, [])).toEqual(new Map([[1, { kind: "overlap", slot: nouvelle.slots[1] }]]));
  });

  it("ignore un créneau incomplet ou à l'envers, et garde l'index brut des autres", () => {
    const nouvelle = reservation(
      "",
      [saisi(0, "wednesday", "19:00", "19:00"), saisi(2, "wednesday", "18:00", "17:00"), saisi(3, "wednesday", "20:00", "21:00")],
      "2026-10-01",
      "2026-12-18",
    );
    expect([...slotIssues(nouvelle, [saline]).keys()]).toEqual([3]);
  });
});

describe("bookingIssueMessage", () => {
  it("dit le créneau en cause, l'occupant et sa période", () => {
    const occupant = reservation("o", [slot("monday", "17:00", "19:00")], "2026-08-17", "2026-09-30", "BASKET CLUB");
    const message = bookingIssueMessage(
      { kind: "taken", slot: slot("monday", "18:00", "20:00"), by: occupant, bySlot: occupant.slots[0] },
      t,
    );
    expect(message).toContain("PreviewReservations.issue.taken");
    expect(message).toContain("days.monday 18:00 – 20:00");
    expect(message).toContain("BASKET CLUB");
    expect(message).toContain("PreviewReservations.period");
  });

  it("un occupant sans période ni nom : « sans limite », usager non renseigné", () => {
    const occupant = reservation("o", [slot("monday", "17:00", "19:00")], undefined, undefined, "");
    const message = bookingIssueMessage(
      { kind: "taken", slot: slot("monday", "18:00", "20:00"), by: occupant, bySlot: occupant.slots[0] },
      t,
    );
    expect(message).toContain("PreviewReservations.issue.noPeriod");
    expect(message).toContain("PreviewReservations.unknownUser");
  });

  it("une période manquante se dit sans créneau", () => {
    expect(bookingIssueMessage({ kind: "period" }, t)).toBe("PreviewReservations.issue.period");
  });

  it("modification d'horaire : heures, créneau changé, voisin de la même réservation", () => {
    expect(bookingIssueMessage({ kind: "hours" }, t)).toBe("PreviewReservations.issue.hours");
    expect(bookingIssueMessage({ kind: "stale" }, t)).toBe("PreviewReservations.issue.stale");
    expect(bookingIssueMessage({ kind: "sibling", slot: slot("monday", "09:00", "10:00") }, t))
      .toBe('PreviewReservations.issue.sibling {"slot":"days.monday 09:00 – 10:00"}');
  });
});

describe("slotHoursIssue", () => {
  // Réservation du trimestre : lundi 9 h 30–11 h 20 (index brut 0) et 14 h–15 h (index brut 2 : le 1 était
  // illisible). Un autre club occupe le lundi 12 h–13 h sur la même période, un 3e en 2027 seulement.
  const indexe = (s: ReservationSlot, index: number): ReservationSlot => ({ ...s, index });
  const t1 = reservation(
    "t1",
    [indexe(slot("monday", "09:30", "11:20"), 0), indexe(slot("monday", "14:00", "15:00"), 2)],
    "2026-08-19",
    "2026-11-05",
  );
  const voisin = reservation("v", [slot("monday", "12:00", "13:00")], "2026-08-19", "2026-11-05", "CLUB B");
  const plusTard = reservation("p", [slot("monday", "11:00", "12:00")], "2027-01-04", "2027-02-18", "CLUB C");
  const cible = { reservationId: "t1", slotIndex: 0, day: "monday" as const };
  const h = (hh: number, mm = 0) => hh * 60 + mm;

  it("accepte de nouvelles heures libres, même sur un créneau occupé à une autre période", () => {
    expect(slotHoursIssue(cible, h(9), h(11, 45), [t1, voisin, plusTard])).toBeNull();
  });

  it("refuse une fin qui ne suit pas le début", () => {
    expect(slotHoursIssue(cible, h(11), h(11), [t1])).toEqual({ kind: "hours" });
    expect(slotHoursIssue(cible, h(11), h(9), [t1])).toEqual({ kind: "hours" });
  });

  it("refuse un créneau qui n'est plus celui affiché", () => {
    expect(slotHoursIssue({ ...cible, slotIndex: 1 }, h(9), h(10), [t1])).toEqual({ kind: "stale" });
    expect(slotHoursIssue({ ...cible, day: "tuesday" }, h(9), h(10), [t1])).toEqual({ kind: "stale" });
    expect(slotHoursIssue(cible, h(9), h(10), [voisin])).toEqual({ kind: "stale" });
  });

  it("refuse de chevaucher un autre créneau de la même réservation", () => {
    expect(slotHoursIssue(cible, h(9, 30), h(14, 30), [t1])).toMatchObject({
      kind: "sibling",
      slot: { day: "monday", start: "09:30", end: "14:30" },
    });
  });

  it("refuse un créneau pris par un autre club sur une période commune, et nomme l'occupant", () => {
    const issue = slotHoursIssue(cible, h(9, 30), h(12, 30), [t1, voisin, plusTard]);
    expect(issue).toMatchObject({ kind: "taken", by: { id: "v" }, slot: { start: "09:30", end: "12:30" } });
  });
});

describe("isSameSlot", () => {
  const affiche = { ...slot("monday", "07:35", "15:10"), index: 3 };

  it("reconnaît le créneau brut affiché, quelle que soit la casse du jour", () => {
    const brut = { day: "Monday", startHour: "07", startMinute: "35", endHour: "15", endMinute: "10", duree: 27300 };
    expect(isSameSlot(brut, affiche)).toBe(true);
  });

  it("refuse un créneau aux heures ou au jour changés, ou illisible", () => {
    expect(isSameSlot({ day: "Monday", startHour: "08", startMinute: "00", endHour: "15", endMinute: "10" }, affiche)).toBe(false);
    expect(isSameSlot({ day: "Tuesday", startHour: "07", startMinute: "35", endHour: "15", endMinute: "10" }, affiche)).toBe(false);
    expect(isSameSlot(undefined, affiche)).toBe(false);
  });
});
