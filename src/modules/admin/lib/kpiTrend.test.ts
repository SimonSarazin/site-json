import { describe, expect, it } from "vitest";

import { computeMonthlyTrend, toCreatedDate } from "./kpiTrend";

/** Point de référence : 15 août 2026 — mois courant = août, mois précédent = juillet. */
const NOW = new Date(2026, 7, 15, 12, 0, 0);

describe("toCreatedDate", () => {
  it("normalise les shapes réels de serverData.created", () => {
    expect(toCreatedDate(new Date(2026, 7, 3))?.getMonth()).toBe(7);
    // epoch SECONDES (legacy PHP) : 1er août 2026 ≈ 1785542400
    expect(toCreatedDate(1785542400)?.getFullYear()).toBe(2026);
    // epoch MILLISECONDES
    expect(toCreatedDate(1785542400000)?.getFullYear()).toBe(2026);
    expect(toCreatedDate({ sec: 1785542400 })?.getFullYear()).toBe(2026);
    expect(toCreatedDate({ $date: "2026-08-01T00:00:00Z" })?.getFullYear()).toBe(2026);
    expect(toCreatedDate({ $date: { $numberLong: "1785542400000" } })?.getFullYear()).toBe(2026);
  });

  it("retourne null pour l'absent, l'invalide et l'inconnu", () => {
    expect(toCreatedDate(null)).toBeNull();
    expect(toCreatedDate(undefined)).toBeNull();
    expect(toCreatedDate("pas une date")).toBeNull();
    expect(toCreatedDate(new Date("invalid"))).toBeNull();
    expect(toCreatedDate({ foo: 1 })).toBeNull();
  });
});

describe("computeMonthlyTrend", () => {
  it("compte les créations du mois courant vs mois précédent (bornes calendaires)", () => {
    const trend = computeMonthlyTrend(
      [
        new Date(2026, 7, 1, 0, 0, 0), //  1er août 00:00 → mois courant (borne incluse)
        new Date(2026, 7, 14), //          14 août → mois courant
        new Date(2026, 6, 31, 23, 59), //  31 juillet → mois précédent
        new Date(2026, 6, 2), //           2 juillet → mois précédent
        new Date(2026, 6, 1), //           1er juillet → mois précédent (borne incluse)
        new Date(2026, 5, 30), //          30 juin → hors fenêtre, ignoré
      ],
      NOW,
    );
    expect(trend).toEqual({ addedThisMonth: 2, addedLastMonth: 3, delta: -1 });
  });

  it("gère le passage d'année (janvier → décembre précédent)", () => {
    const trend = computeMonthlyTrend(
      [new Date(2026, 0, 5), new Date(2025, 11, 20), new Date(2025, 10, 30)],
      new Date(2026, 0, 15),
    );
    expect(trend).toEqual({ addedThisMonth: 1, addedLastMonth: 1, delta: 0 });
  });

  it("ignore les dates invalides sans fausser les compteurs", () => {
    const trend = computeMonthlyTrend([null, "n/a", new Date(2026, 7, 2)], NOW);
    expect(trend).toEqual({ addedThisMonth: 1, addedLastMonth: 0, delta: 1 });
  });

  it("périmètre vide → tendance neutre", () => {
    expect(computeMonthlyTrend([], NOW)).toEqual({ addedThisMonth: 0, addedLastMonth: 0, delta: 0 });
  });
});
