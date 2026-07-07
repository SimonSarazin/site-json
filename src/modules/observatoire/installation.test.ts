import { describe, it, expect } from "vitest";
import type { Reservation, ReservationSlot } from "@/modules/search/lib/reservations";
import {
  weeklyAmplitudeMinutes,
  mergeIntervals,
  computeEquipmentUsage,
  utilizationRate,
  activityDistribution,
  formatHours,
} from "./installation";

/* ── Fixtures ────────────────────────────────────────────────────────────── */

function slot(day: string, startMinutes: number, endMinutes: number): ReservationSlot {
  const fmt = (m: number) =>
    `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  return {
    day: day as ReservationSlot["day"],
    start: fmt(startMinutes),
    end: fmt(endMinutes),
    startMinutes,
    endMinutes,
  };
}

function reservation(partial: Partial<Reservation>): Reservation {
  return { id: "r", resourceIds: [], user: "", slots: [], ...partial };
}

/* ── weeklyAmplitudeMinutes ──────────────────────────────────────────────── */

describe("weeklyAmplitudeMinutes", () => {
  it("calcule l'amplitude 8h-22h × 7j = 5880 min (98 h)", () => {
    expect(weeklyAmplitudeMinutes({ startHour: 8, endHour: 22, days: 7 })).toBe(5880);
  });

  it("borne à 0 une amplitude inversée (garde division par zéro)", () => {
    expect(weeklyAmplitudeMinutes({ startHour: 22, endHour: 8, days: 7 })).toBe(0);
    expect(weeklyAmplitudeMinutes({ startHour: 8, endHour: 8, days: 7 })).toBe(0);
  });
});

/* ── mergeIntervals ──────────────────────────────────────────────────────── */

describe("mergeIntervals", () => {
  it("laisse intacts des intervalles disjoints (triés)", () => {
    expect(mergeIntervals([[600, 660], [480, 540]])).toEqual([[480, 540], [600, 660]]);
  });

  it("fusionne des intervalles chevauchants", () => {
    expect(mergeIntervals([[480, 600], [540, 660]])).toEqual([[480, 660]]);
  });

  it("absorbe un intervalle inclus", () => {
    expect(mergeIntervals([[480, 660], [500, 550]])).toEqual([[480, 660]]);
  });

  it("fusionne des intervalles adjacents", () => {
    expect(mergeIntervals([[480, 540], [540, 600]])).toEqual([[480, 600]]);
  });

  it("ignore les intervalles vides ou inversés, gère l'entrée vide", () => {
    expect(mergeIntervals([])).toEqual([]);
    expect(mergeIntervals([[540, 540], [600, 480]])).toEqual([]);
  });
});

/* ── computeEquipmentUsage ───────────────────────────────────────────────── */

describe("computeEquipmentUsage", () => {
  it("agrège durées, créneaux et activités par équipement", () => {
    const usage = computeEquipmentUsage(
      [
        reservation({
          id: "r1",
          resourceIds: ["poi1"],
          activity: "BADMINTON",
          slots: [slot("monday", 1020, 1140), slot("thursday", 1020, 1140)],
        }),
      ],
      ["poi1"],
    );
    const u = usage.get("poi1")!;
    expect(u.reservedMinutes).toBe(240);
    expect(u.occupiedMinutes).toBe(240); // jours différents : pas de fusion
    expect(u.slotCount).toBe(2);
    expect(u.activities).toEqual(["BADMINTON"]);
  });

  it("fusionne les chevauchements d'un même jour : occupied < reserved", () => {
    const usage = computeEquipmentUsage(
      [
        reservation({ id: "r1", resourceIds: ["poi1"], slots: [slot("monday", 1020, 1140)] }),
        reservation({ id: "r2", resourceIds: ["poi1"], slots: [slot("monday", 1080, 1200)] }),
      ],
      ["poi1"],
    );
    const u = usage.get("poi1")!;
    expect(u.reservedMinutes).toBe(240);
    expect(u.occupiedMinutes).toBe(180); // 17:00→20:00 fusionné
  });

  it("ne fusionne pas le même horaire sur des jours différents", () => {
    const usage = computeEquipmentUsage(
      [
        reservation({ id: "r1", resourceIds: ["poi1"], slots: [slot("monday", 1020, 1140)] }),
        reservation({ id: "r2", resourceIds: ["poi1"], slots: [slot("friday", 1020, 1140)] }),
      ],
      ["poi1"],
    );
    expect(usage.get("poi1")!.occupiedMinutes).toBe(240);
  });

  it("crée une entrée à zéro pour un équipement sans réservation", () => {
    const usage = computeEquipmentUsage([], ["poi1", "poi2"]);
    expect(usage.get("poi1")).toEqual({
      reservedMinutes: 0,
      occupiedMinutes: 0,
      slotCount: 0,
      activities: [],
    });
    expect(usage.size).toBe(2);
  });

  it("ignore un poiId pointé par une answer mais hors installation", () => {
    const usage = computeEquipmentUsage(
      [reservation({ id: "r1", resourceIds: ["autre"], slots: [slot("monday", 600, 660)] })],
      ["poi1"],
    );
    expect(usage.get("poi1")!.slotCount).toBe(0);
    expect(usage.has("autre")).toBe(false);
  });
});

/* ── utilizationRate ─────────────────────────────────────────────────────── */

describe("utilizationRate", () => {
  it("calcule le ratio occupé/amplitude", () => {
    expect(utilizationRate(2940, 5880)).toBe(0.5);
  });

  it("renvoie 0 pour une amplitude nulle ou négative (pas de NaN)", () => {
    expect(utilizationRate(100, 0)).toBe(0);
    expect(utilizationRate(100, -60)).toBe(0);
  });

  it("peut dépasser 1 — le clamp est la responsabilité de l'UI", () => {
    expect(utilizationRate(7000, 5880)).toBeGreaterThan(1);
  });
});

/* ── activityDistribution ────────────────────────────────────────────────── */

describe("activityDistribution", () => {
  const list = [
    reservation({
      id: "r1",
      activity: "BADMINTON",
      slots: [slot("monday", 1020, 1140), slot("thursday", 1020, 1140)], // 4 h
    }),
    reservation({ id: "r2", activity: "VOLLEY", slots: [slot("friday", 540, 630)] }), // 1,5 h
    reservation({ id: "r3", activity: "BADMINTON", slots: [slot("friday", 600, 660)] }), // 1 h
  ];

  it("pondère en heures (arrondi 0,1) et trie décroissant", () => {
    expect(activityDistribution(list, "hours", "?")).toEqual([
      { name: "BADMINTON", value: 5 },
      { name: "VOLLEY", value: 1.5 },
    ]);
  });

  it("pondère en nombre de créneaux", () => {
    expect(activityDistribution(list, "slots", "?")).toEqual([
      { name: "BADMINTON", value: 3 },
      { name: "VOLLEY", value: 1 },
    ]);
  });

  it("regroupe les activités absentes sous le libellé de repli", () => {
    const anon = [reservation({ id: "r1", slots: [slot("monday", 600, 660)] })];
    expect(activityDistribution(anon, "slots", "Non renseignée")).toEqual([
      { name: "Non renseignée", value: 1 },
    ]);
  });

  it("omet une activité sans aucun créneau", () => {
    const empty = [reservation({ id: "r1", activity: "JUDO", slots: [] })];
    expect(activityDistribution(empty, "hours", "?")).toEqual([]);
  });
});

/* ── formatHours ─────────────────────────────────────────────────────────── */

describe("formatHours", () => {
  it("convertit en heures avec 1 décimale, locale fr", () => {
    expect(formatHours(150)).toBe("2,5");
    expect(formatHours(120)).toBe("2");
    expect(formatHours(0)).toBe("0");
  });
});
