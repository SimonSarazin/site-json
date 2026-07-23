import { describe, expect, it } from "vitest";

import { TERRITOIRES_62 } from "./territoires62";

/** Slugs officiels — alignés sur les 9 comités locaux du WP parent62.org. */
const SLUGS = [
  "arrageois",
  "artois",
  "audomarois",
  "boulonnais",
  "calaisis",
  "entre-mer-et-terres",
  "fsm-henin-carvin",
  "fsm-lens-lievin",
  "ternois-bruaysis",
];

describe("TERRITOIRES_62", () => {
  it("expose les 9 comités locaux avec les slugs officiels", () => {
    expect(TERRITOIRES_62.map((t) => t.slug)).toEqual(SLUGS);
  });

  it("a des communes renseignées pour chaque territoire (import PDF T0.5)", () => {
    for (const t of TERRITOIRES_62) {
      expect(t.communes.length, t.slug).toBeGreaterThan(0);
    }
  });

  it("porte pour chaque territoire le libellé EXACT du champ `territoires` et sa variable CSS", () => {
    // Les libellés sont les valeurs stockées en base (costum.lists.territoires) —
    // toute divergence (accent, apostrophe) ferait remonter 0 résultat sans erreur.
    const bySlug = Object.fromEntries(TERRITOIRES_62.map((t) => [t.slug, t]));
    expect(bySlug["fsm-henin-carvin"].label).toBe("Familles en sol mineur Hénin Carvin");
    expect(bySlug["fsm-henin-carvin"].color).toBe("var(--territoire-fsm-henin-carvin)");
    expect(bySlug["ternois-bruaysis"].label).toBe("Ternois Bruaysis");
    for (const t of TERRITOIRES_62) {
      expect(t.color, t.slug).toBe(`var(--territoire-${t.slug})`);
    }
  });
});
