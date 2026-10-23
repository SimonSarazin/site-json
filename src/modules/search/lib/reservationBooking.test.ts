import { describe, it, expect } from "vitest";
import type { Reservation, ReservationSlot } from "./reservations";
import { bookingIssue, bookingIssueMessage, resolvePeriodFilter } from "./reservationBooking";

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
});
