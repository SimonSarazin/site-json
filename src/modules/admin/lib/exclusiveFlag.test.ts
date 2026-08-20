import { describe, it, expect } from "vitest";
import { exclusiveRowId, itemsToUnset } from "./exclusiveFlag";

const row = (id: string, featured: boolean | undefined) => ({
  id,
  serverData: { id, featured },
});

describe("exclusiveRowId", () => {
  it("lit `id` en priorité", () => {
    expect(exclusiveRowId({ id: "a1", serverData: { id: "other" } })).toBe("a1");
  });

  it("replie sur `serverData.id` si `id` est absent", () => {
    expect(exclusiveRowId({ serverData: { id: "a2" } })).toBe("a2");
  });

  it("renvoie `null` sans id exploitable", () => {
    expect(exclusiveRowId({})).toBeNull();
  });
});

describe("itemsToUnset", () => {
  it("sélectionne les lignes à `true` autres que la cible", () => {
    const rows = [row("a", true), row("b", false), row("c", true), row("target", false)];
    const result = itemsToUnset(rows, "featured", "target");
    expect(result.map((r) => exclusiveRowId(r))).toEqual(["a", "c"]);
  });

  it("exclut la cible même si elle porte déjà le flag (pas de self-unset)", () => {
    const rows = [row("target", true), row("b", true)];
    const result = itemsToUnset(rows, "featured", "target");
    expect(result.map((r) => exclusiveRowId(r))).toEqual(["b"]);
  });

  it("renvoie un tableau vide si aucune autre ligne n'est à `true`", () => {
    const rows = [row("a", false), row("b", undefined)];
    expect(itemsToUnset(rows, "featured", "target")).toEqual([]);
  });

  it("`targetId` null (id introuvable) n'exclut aucune ligne par id — seule la valeur du flag filtre", () => {
    const rows = [row("a", true), row("b", false)];
    expect(itemsToUnset(rows, "featured", null).map((r) => exclusiveRowId(r))).toEqual(["a"]);
  });

  it("lit le flag via un chemin pointé (cohérence avec `getPath`/colonnes admin)", () => {
    const rows = [
      { id: "a", serverData: { nested: { flag: true } } },
      { id: "target", serverData: { nested: { flag: false } } },
    ];
    expect(itemsToUnset(rows, "nested.flag", "target").map((r) => exclusiveRowId(r))).toEqual(["a"]);
  });
});
