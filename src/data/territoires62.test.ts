import { describe, expect, it } from "vitest";

import {
  TERRITOIRES_62,
  findTerritoireByCommune,
  territoireColorMapping,
  territoireLabels,
  territoireTag,
} from "./territoires62";

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

  it("mappe chaque tag sur sa variable CSS et son libellé", () => {
    const colors = territoireColorMapping();
    const labels = territoireLabels();
    expect(colors[territoireTag("fsm-henin-carvin")]).toBe(
      "var(--territoire-fsm-henin-carvin)",
    );
    expect(labels[territoireTag("fsm-henin-carvin")]).toBe(
      "Familles en sol mineur Hénin Carvin",
    );
    expect(labels[territoireTag("ternois-bruaysis")]).toBe("Ternois Bruaysis");
    expect(Object.keys(colors)).toHaveLength(9);
  });
});

describe("findTerritoireByCommune", () => {
  it("reste inactive tant que la dérivation par nom n'est pas tranchée (lot D-C)", () => {
    // `communes` contient des noms, pas des codes : la recherche par code
    // postal/INSEE ne matche jamais — comportement inchangé (null), documenté.
    expect(findTerritoireByCommune({ postalCode: "62000" })).toBeNull();
    expect(findTerritoireByCommune({ codeInsee: "62041" })).toBeNull();
    expect(findTerritoireByCommune({})).toBeNull();
  });
});
