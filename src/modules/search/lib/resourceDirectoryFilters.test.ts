import { describe, it, expect } from "vitest";
import {
  addressZoneIds,
  defaultOpenFilterGroups,
  matchesCapacity,
  matchesZones,
  parentIdsFilter,
  parseCapacityRange,
  resourceCapacity,
  selectedZones,
  thematicParentIds,
} from "./resourceDirectoryFilters";

describe("parseCapacityRange", () => {
  it("lit les bornes, côté vide = sans limite", () => {
    expect(parseCapacityRange("10-30")).toEqual({ min: 10, max: 30 });
    expect(parseCapacityRange("50-")).toEqual({ min: 50, max: Infinity });
    expect(parseCapacityRange("-")).toBeNull();
    expect(parseCapacityRange("dix")).toBeNull();
  });
});

describe("resourceCapacity", () => {
  it("salle de réunion : la fourchette de personnes", () => {
    expect(resourceCapacity({ kind: "meeting", count: 2, range: { min: 8, max: 20 } })).toEqual({ min: 8, max: 20 });
  });
  it("coworking / hébergement : le nombre de postes ou de chambres", () => {
    expect(resourceCapacity({ kind: "coworking", count: 12 })).toEqual({ min: 12, max: 12 });
  });
  it("inconnue → null", () => {
    expect(resourceCapacity(undefined)).toBeNull();
    expect(resourceCapacity({ kind: "coworking", count: 0 })).toBeNull();
    expect(resourceCapacity({ kind: "meeting", count: 1, range: { min: 0, max: 0 } })).toBeNull();
  });
  it("salle « à partir de N » (max non saisi) : capacité N, comme la pastille — et non inconnue", () => {
    const cap = resourceCapacity({ kind: "meeting", count: 1, range: { min: 10, max: 0 } });
    expect(cap).toEqual({ min: 10, max: 10 });
    expect(matchesCapacity(cap, ["10-30"])).toBe(true);
    expect(resourceCapacity({ kind: "meeting", count: 1, range: { min: 0, max: 20 } })).toEqual({ min: 20, max: 20 });
  });
});

describe("matchesCapacity", () => {
  it("rien de coché : tout passe, même sans capacité connue", () => {
    expect(matchesCapacity(null, [])).toBe(true);
  });
  it("une fourchette qui recoupe une tranche passe, bornes incluses", () => {
    expect(matchesCapacity({ min: 8, max: 20 }, ["1-10"])).toBe(true);
    expect(matchesCapacity({ min: 8, max: 20 }, ["10-30"])).toBe(true);
    expect(matchesCapacity({ min: 8, max: 20 }, ["30-50"])).toBe(false);
    expect(matchesCapacity({ min: 60, max: 60 }, ["30-50", "50-"])).toBe(true);
    // Pile sur une borne : dans les deux tranches qui la partagent.
    expect(matchesCapacity({ min: 10, max: 10 }, ["1-10"])).toBe(true);
    expect(matchesCapacity({ min: 10, max: 10 }, ["10-30"])).toBe(true);
  });
  it("capacité inconnue avec une tranche cochée : exclue", () => {
    expect(matchesCapacity(null, ["1-10"])).toBe(false);
  });
});

describe("selectedZones / matchesZones", () => {
  const sbf = {
    a: { field: "Zlevel3", type: "scopeList", value: { id: "Z", type: "level3" } },
    b: { field: "priceHourly", type: null, value: ["0-20"] },
  } as never;

  it("ne lit que les zones cochées", () => {
    expect(selectedZones(sbf)).toEqual(["Z"]);
    expect(selectedZones(undefined)).toEqual([]);
  });

  it("garde un lieu dans une des zones, écarte les autres et les lieux inconnus", () => {
    expect(matchesZones(["P", "Z"], ["Z"])).toBe(true);
    expect(matchesZones(["P", "Y"], ["Z"])).toBe(false);
    expect(matchesZones(undefined, ["Z"])).toBe(false);
    expect(matchesZones(undefined, [])).toBe(true);
  });

  it("zone reconnue quel que soit le niveau sous lequel l'adresse la porte (DOM : pays = région)", () => {
    // Option « Réunion » de niveau 3, adresse qui ne porte la zone que sous level1.
    expect(matchesZones(["RE-zone"], ["RE-zone"])).toBe(true);
  });
});

describe("parentIdsFilter", () => {
  it("sans réseau : le lieu cliqué seul, ou aucun filtre", () => {
    expect(parentIdsFilter(null, "p1")).toEqual(["p1"]);
    expect(parentIdsFilter(null, null)).toBeNull();
  });
  it("avec réseau : ses membres, croisés avec le lieu cliqué", () => {
    expect(parentIdsFilter(["p1", "p2"], null)).toEqual(["p1", "p2"]);
    expect(parentIdsFilter(["p1", "p2"], "p2")).toEqual(["p2"]);
    expect(parentIdsFilter(["p1"], "p3")).toEqual([]);
  });
});

describe("thematicParentIds", () => {
  it("aucun réseau coché : null", () => {
    expect(thematicParentIds({})).toBeNull();
    expect(thematicParentIds(undefined)).toBeNull();
  });
  it("réseaux cochés : union de leurs lieux membres, sans les autres filtres", () => {
    const sbf = {
      a: { field: "parentId", value: ["p1", "p2"] },
      b: { field: "parentId", value: ["p2", "p3"] },
      e: { field: "_id", value: ["autre"] }, // un autre groupe écrivant `_id` n'est pas un réseau
      c: { field: "priceHourly", value: ["0-20"] },
      d: { field: "Zlevel3", type: "scopeList", value: { id: "Z", type: "level3" } },
    } as never;
    expect(thematicParentIds(sbf)).toEqual(["p1", "p2", "p3"]);
  });
  it("réseau coché SANS lieu membre : [] (et non null — sinon tout l'annuaire s'afficherait)", () => {
    expect(thematicParentIds({ a: { field: "parentId", value: [] } } as never)).toEqual([]);
  });
});

describe("defaultOpenFilterGroups", () => {
  const prix = ["priceHourly", "priceHalfDay", "priceFullDay"];
  it("défaut historique : type + 1er groupe prix", () => {
    expect(defaultOpenFilterGroups({ thematic: false, capacity: false, region: false, priceGroupIds: prix })).toEqual([
      "resourceType",
      "priceHourly",
    ]);
  });
  it("ne nomme jamais un groupe absent ; la seule facette configurée arrive ouverte", () => {
    expect(defaultOpenFilterGroups({ thematic: false, capacity: false, region: true, priceGroupIds: [] })).toEqual([
      "resourceType",
      "region",
    ]);
    expect(defaultOpenFilterGroups({ thematic: false, capacity: false, region: false, priceGroupIds: [] })).toEqual([
      "resourceType",
    ]);
  });
  it("tiers-lieux : type + thématique (ordre d'affichage)", () => {
    expect(defaultOpenFilterGroups({ thematic: true, capacity: true, region: true, priceGroupIds: [] })).toEqual([
      "resourceType",
      "thematic",
    ]);
  });
});

describe("addressZoneIds", () => {
  it("toutes les zones de l'adresse, commune comprise (level5 et localityId aussi)", () => {
    expect(
      addressZoneIds({ level1: "FR", level3: "OCC", level4: "31", level5: "Z5", localityId: "C1", postalCode: "31120" }),
    ).toEqual(["FR", "OCC", "31", "Z5", "C1"]);
  });
  it("adresse absente ou vide : aucune zone", () => {
    expect(addressZoneIds(undefined)).toEqual([]);
    expect(addressZoneIds({ level1: "" })).toEqual([]);
  });
});
