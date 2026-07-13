import { describe, it, expect } from "vitest";
import { buildFinderMongoFilters } from "./finderFilters";
import type { FinderFilter } from "../types";

describe("buildFinderMongoFilters", () => {
  it("sans filtre → objet vide", () => {
    expect(buildFinderMongoFilters([])).toEqual({});
    expect(buildFinderMongoFilters([], [])).toEqual({});
  });

  it("inclusion mono-valeur → scalaire (comportement historique)", () => {
    const include: FinderFilter[] = [
      { attributeName: "tags", valueName: "TiersLieux" },
      { attributeName: "source.key", valueName: "tlorg" },
    ];
    expect(buildFinderMongoFilters(include)).toEqual({
      tags: "TiersLieux",
      "source.key": "tlorg",
    });
  });

  it("inclusion multi-valeur sur une même clé → $in", () => {
    const include: FinderFilter[] = [
      { attributeName: "tags", valueName: "A" },
      { attributeName: "tags", valueName: "B" },
    ];
    expect(buildFinderMongoFilters(include)).toEqual({ tags: { $in: ["A", "B"] } });
  });

  it("exclusion seule (attribut sans inclusion) → $nin, pas de $or", () => {
    const out = buildFinderMongoFilters([], [
      { attributeName: "tags", valueName: "RéseauTiersLieux" },
    ]);
    expect(out).toEqual({ tags: { $nin: ["RéseauTiersLieux"] } });
    expect(out.$or).toBeUndefined();
  });

  it("collision inclusion+exclusion sur `tags` → idiome prouvé $or + $nin", () => {
    const out = buildFinderMongoFilters(
      [{ attributeName: "tags", valueName: "TiersLieux" }],
      [{ attributeName: "tags", valueName: "RéseauTiersLieux" }],
    );
    // Reproduit exactement la config search tiers-lieux vérifiée en base.
    expect(out).toEqual({
      $or: { tags: { $in: ["TiersLieux"] } },
      tags: { $nin: ["RéseauTiersLieux"] },
    });
  });

  it("inclusion sur un attribut, exclusion sur un AUTRE → pas de $or", () => {
    const out = buildFinderMongoFilters(
      [{ attributeName: "tags", valueName: "TiersLieux" }],
      [{ attributeName: "category", valueName: "network" }],
    );
    expect(out).toEqual({
      tags: "TiersLieux",
      category: { $nin: ["network"] },
    });
    expect(out.$or).toBeUndefined();
  });

  it("exclusion multi-valeur groupée → un seul $nin", () => {
    const out = buildFinderMongoFilters([], [
      { attributeName: "tags", valueName: "RéseauTiersLieux" },
      { attributeName: "tags", valueName: "Fédération" },
    ]);
    expect(out).toEqual({ tags: { $nin: ["RéseauTiersLieux", "Fédération"] } });
  });

  it("le paramètre exclude est optionnel (défaut = [])", () => {
    expect(buildFinderMongoFilters([{ attributeName: "type", valueName: "NGO" }])).toEqual({
      type: "NGO",
    });
  });

  // Épingle la limite documentée : ≥2 attributs en collision fusionnent sous un
  // seul `$or`-objet (sémantique OR côté backend). Cas exotique non requis par
  // les finders réels — ce test fige le comportement, il ne le cautionne pas.
  it("collision multi-attributs → un seul $or (limite connue du DSL)", () => {
    const out = buildFinderMongoFilters(
      [
        { attributeName: "tags", valueName: "A" },
        { attributeName: "category", valueName: "C" },
      ],
      [
        { attributeName: "tags", valueName: "X" },
        { attributeName: "category", valueName: "Y" },
      ],
    );
    expect(out).toEqual({
      $or: { tags: { $in: ["A"] }, category: { $in: ["C"] } },
      tags: { $nin: ["X"] },
      category: { $nin: ["Y"] },
    });
  });
});
