import { describe, it, expect } from "vitest";
import { normalizeTags } from "./normalizeTags";

describe("normalizeTags — toutes les formes de `tags` du backend", () => {
  it("tableau : chaînes non vides, dédoublonnées, ordre préservé", () => {
    expect(normalizeTags(["a", "b", "a", "", 3, null])).toEqual(["a", "b"]);
  });

  it("objet PHP à index non contigus (séquelle d'un $unset) : les VALEURS sont les tags", () => {
    expect(normalizeTags({ "1": "Pedagogie", "3": "Santé" })).toEqual(["Pedagogie", "Santé"]);
  });

  it("dictionnaire de présence : les CLÉS sont les tags", () => {
    expect(normalizeTags({ Pedagogie: true, Santé: true })).toEqual(["Pedagogie", "Santé"]);
  });

  it("chaîne seule, absent, nombre : jamais d'exception, toujours un tableau", () => {
    expect(normalizeTags("solo")).toEqual(["solo"]);
    expect(normalizeTags(undefined)).toEqual([]);
    expect(normalizeTags(null)).toEqual([]);
    expect(normalizeTags(42)).toEqual([]);
    expect(normalizeTags({})).toEqual([]);
  });
});
