import { describe, it, expect } from "vitest";

import { buildOpenSearchFilters } from "./AdminReferenceSection";

/**
 * Filtres de la recherche de candidates (section `reference`) — décision 2026-08-20 :
 * politique open-data 3 positions + ciblage du vivier (commun / par collection) + garde-fous
 * non configurables fusionnés MÊME-CLÉ. Le défaut doit rester byte-fidèle au referenceTable
 * legacy (isOpenData:true + $nin), les 6 sections du parc sans `search` ne bougent pas.
 */
describe("buildOpenSearchFilters", () => {
  it("défaut (sans config) : fidèle referenceTable legacy", () => {
    expect(buildOpenSearchFilters(undefined, "organizations", "monSite")).toEqual({
      "preferences.isOpenData": true,
      "reference.costum": { $nin: ["monSite"] },
      "source.keys": { $nin: ["monSite"] },
    });
  });

  it("optOut : tout sauf refus explicite (booléen ET chaîne)", () => {
    const f = buildOpenSearchFilters({ openData: "optOut" }, "organizations", "monSite");
    expect(f["preferences.isOpenData"]).toEqual({ $nin: [false, "false"] });
  });

  it("off : aucun filtre open-data", () => {
    const f = buildOpenSearchFilters({ openData: "off" }, "organizations", "monSite");
    expect(f).not.toHaveProperty("preferences.isOpenData");
  });

  it("ciblage commun + par collection : le byType FUSIONNE par-dessus, sans fuiter vers les autres types", () => {
    const search = {
      defaultFilters: { "address.postalCode": { $in: ["97430"] } },
      defaultFiltersByType: { organizations: { "source.keys": "sportSanteBienetre" } },
    };
    const orgs = buildOpenSearchFilters(search, "organizations", "monSite");
    // scalaire config → $in, ET le $nin de garde s'y fusionne (même clé, jamais écrasé)
    expect(orgs["source.keys"]).toEqual({ $in: ["sportSanteBienetre"], $nin: ["monSite"] });
    expect(orgs["address.postalCode"]).toEqual({ $in: ["97430"] });
    const events = buildOpenSearchFilters(search, "events", "monSite");
    // le ciblage d'orgs ne fuit pas : events ne voit que le commun + la garde nue
    expect(events["source.keys"]).toEqual({ $nin: ["monSite"] });
    expect(events["address.postalCode"]).toEqual({ $in: ["97430"] });
  });

  it("la garde $nin est NON écrasable : un $nin config s'unionne, le slug du site reste exclu", () => {
    const f = buildOpenSearchFilters(
      { defaultFilters: { "reference.costum": { $nin: ["autreSite"] } } },
      "organizations",
      "monSite",
    );
    expect(f["reference.costum"]).toEqual({ $nin: ["autreSite", "monSite"] });
  });
});
