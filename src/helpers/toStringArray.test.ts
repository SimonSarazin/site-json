import { describe, it, expect } from "vitest";
import { toStringArray } from "./toStringArray";

describe("toStringArray — toutes les formes d'un champ multi-valeurs du backend", () => {
  it("tableau : chaînes non vides, ordre préservé (pas de dédoublonnage : c'est au lecteur de décider)", () => {
    expect(toStringArray(["a", "b", "a", "", 3, null])).toEqual(["a", "b", "a"]);
  });

  it("chaîne seule → [chaîne], vide → []", () => {
    expect(toStringArray(" solo ")).toEqual(["solo"]);
    expect(toStringArray("  ")).toEqual([]);
  });

  it("tableau PHP à index non contigus (clés toutes entières) : les VALEURS sont les éléments", () => {
    expect(toStringArray({ "0": "lieux-sante", "2": "pharmacie" })).toEqual(["lieux-sante", "pharmacie"]);
    // Une valeur non textuelle est écartée, jamais remplacée par son index.
    expect(toStringArray({ "0": "Santé", "2": 2024 })).toEqual(["Santé"]);
  });

  it("dictionnaire de présence (clés non entières) : les CLÉS sont les éléments", () => {
    expect(toStringArray({ Pedagogie: true, Santé: true })).toEqual(["Pedagogie", "Santé"]);
    // Forme d'un POST form-urlencoded legacy : les valeurs « true » ne sont pas des éléments.
    expect(toStringArray({ Pedagogie: "true", Santé: "true" })).toEqual(["Pedagogie", "Santé"]);
  });

  it("absent, nombre, objet vide : jamais d'exception, toujours un tableau", () => {
    expect(toStringArray(undefined)).toEqual([]);
    expect(toStringArray(null)).toEqual([]);
    expect(toStringArray(42)).toEqual([]);
    expect(toStringArray({})).toEqual([]);
  });
});
