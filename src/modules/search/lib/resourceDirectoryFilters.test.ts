import { describe, it, expect } from "vitest";
import {
  matchesCapacity,
  matchesZones,
  parentIdsFilter,
  parseCapacityRange,
  resourceCapacity,
  selectedZones,
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
    expect(selectedZones(sbf)).toEqual([{ id: "Z", level: "level3" }]);
    expect(selectedZones(undefined)).toEqual([]);
  });

  it("garde un lieu dans une des zones, écarte les autres et les lieux inconnus", () => {
    const zones = [{ id: "Z", level: "level3" }];
    expect(matchesZones({ level3: "Z" }, zones)).toBe(true);
    expect(matchesZones({ level3: "Y" }, zones)).toBe(false);
    expect(matchesZones(undefined, zones)).toBe(false);
    expect(matchesZones(undefined, [])).toBe(true);
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
