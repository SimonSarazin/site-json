import { describe, it, expect } from "vitest";
import { sortByUsageRate, sortOrderFromParam } from "./usageSort";

const items = [
  { id: "a", name: "Arena" },
  { id: "b", name: "Bassin" },
  { id: "c", name: "City-stade" },
  { id: "d", name: "Dojo" },
  { name: "Sans identifiant" },
];
const rates = new Map([
  ["b", 0.2],
  ["c", 0.5],
  ["d", 0.2],
]);
const idOf = (item: { id?: string }) => item.id;
const names = (list: Array<{ name: string }>) => list.map((i) => i.name);

describe("sortOrderFromParam", () => {
  it("desc ou asc ; toute autre valeur → tri du serveur", () => {
    expect(sortOrderFromParam("desc")).toBe("desc");
    expect(sortOrderFromParam("asc")).toBe("asc");
    expect(sortOrderFromParam("taux")).toBeNull();
    expect(sortOrderFromParam(null)).toBeNull();
  });
});

describe("sortByUsageRate", () => {
  it("décroissant : les équipements à taux d'abord, puis les autres dans l'ordre reçu", () => {
    expect(names(sortByUsageRate(items, idOf, rates, "desc"))).toEqual([
      "City-stade", "Bassin", "Dojo", "Arena", "Sans identifiant",
    ]);
  });

  it("croissant : les autres restent EN FIN, ils n'ont pas de taux (et non un taux nul)", () => {
    expect(names(sortByUsageRate(items, idOf, rates, "asc"))).toEqual([
      "Bassin", "Dojo", "City-stade", "Arena", "Sans identifiant",
    ]);
  });

  it("à taux égal, l'ordre reçu (le nom) départage ; un taux nul est un taux", () => {
    const sorted = sortByUsageRate(items, idOf, new Map([["d", 0], ["a", 0]]), "desc");
    expect(names(sorted)).toEqual(["Arena", "Dojo", "Bassin", "City-stade", "Sans identifiant"]);
  });

  it("ne modifie pas la liste reçue", () => {
    const copy = [...items];
    sortByUsageRate(items, idOf, rates, "desc");
    expect(items).toEqual(copy);
  });
});
