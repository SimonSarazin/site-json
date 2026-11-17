import { describe, it, expect } from "vitest";
import type { Reservation, ReservationSlot } from "./reservations";
import type { ReservationsConf } from "../schema";
import { slotUsageOf } from "./slotUsage";

const TODAY = "2026-11-11";
const PLAGE = 14 * 60 * 7;

const slot = (start: number, end: number): ReservationSlot => ({
  day: "monday", start: `${start}:00`, end: `${end}:00`, startMinutes: start * 60, endMinutes: end * 60,
});
const resa = (poi: string, slots: ReservationSlot[], periodEnd = "2027-07-02"): Reservation => ({
  id: `${poi}-${periodEnd}`,
  resources: [{ id: poi }],
  resourceIds: [poi],
  user: "",
  periodStart: "2026-08-17",
  periodEnd,
  slots,
});

const base: ReservationsConf = {
  form: "f",
  step: "s",
  fields: { finder: "fi", slots: "sl" },
} as ReservationsConf;
const withUsage: ReservationsConf = {
  ...base,
  usage: { referenceAmplitude: { startHour: 8, endHour: 22, days: 7 }, schoolUserTypes: [] },
};

const reservations = [resa("a", [slot(8, 12)]), resa("b", [slot(18, 20)], "2026-07-03")];

describe("slotUsageOf — créneaux des équipements d'une page", () => {
  it("planning = créneau en cours ou à venir ; taux de ces seuls équipements, sur la plage de `usage`", () => {
    const usage = slotUsageOf(reservations, TODAY, withUsage);
    expect([...usage.planned]).toEqual(["a"]);
    expect(usage.rates).toEqual(new Map([["a", 240 / PLAGE]]));
  });

  it("sans `usage`, pas de plage de référence : le planning, pas de taux", () => {
    const usage = slotUsageOf([...reservations], TODAY, base);
    expect([...usage.planned]).toEqual(["a"]);
    expect(usage.rates.size).toBe(0);
  });

  it("même tableau, même jour, même plage : le calcul n'est pas refait ; un autre jour, si", () => {
    const list = [...reservations];
    const first = slotUsageOf(list, TODAY, withUsage);
    expect(slotUsageOf(list, TODAY, withUsage)).toBe(first);
    expect(slotUsageOf(list, "2027-08-01", withUsage)).not.toBe(first);
  });
});
