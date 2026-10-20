import { describe, expect, it } from "vitest";
import { toArrayOrValues } from "./dataTransform";
import { listDepenseKeys, resolveDepenseKey } from "./depenseKey";

describe("resolveDepenseKey", () => {
  it("rend la clé réelle sur un objet à clés creuses", () => {
    // Le cas qui motive le module : la dépense de clé "3" est en position 1.
    const depenses = { "0": { poste: "A" }, "3": { poste: "B" } };

    expect(resolveDepenseKey(depenses, 0)).toBe("0");
    expect(resolveDepenseKey(depenses, 1)).toBe("3");
  });

  it("reste aligné sur ce que `toArrayOrValues` produit", () => {
    // La garantie centrale : keys[i] décrit values[i]. Si cette invariance cassait,
    // tous les appels serveur viseraient la mauvaise dépense.
    const depenses = { "0": { poste: "A" }, "2": { poste: "B" }, "5": { poste: "C" } };
    const values = toArrayOrValues<{ poste: string }>(depenses);
    const keys = listDepenseKeys(depenses);

    values.forEach((value, index) => {
      expect((depenses as Record<string, { poste: string }>)[keys[index]]).toBe(value);
    });
  });

  it("rend la position sur un vrai tableau", () => {
    expect(resolveDepenseKey([{ poste: "A" }, { poste: "B" }], 1)).toBe("1");
  });

  it("rend null hors bornes plutôt qu'une clé inventée", () => {
    expect(resolveDepenseKey({ "0": {}, "3": {} }, 2)).toBeNull();
    expect(resolveDepenseKey([{ poste: "A" }], 5)).toBeNull();
  });

  it("rend null sur un index invalide", () => {
    expect(resolveDepenseKey([{ poste: "A" }], -1)).toBeNull();
    expect(resolveDepenseKey([{ poste: "A" }], 1.5)).toBeNull();
  });

  it("rend null sur une entrée absente ou scalaire", () => {
    expect(resolveDepenseKey(null, 0)).toBeNull();
    expect(resolveDepenseKey(undefined, 0)).toBeNull();
    expect(resolveDepenseKey("depense", 0)).toBeNull();
  });
});

describe("listDepenseKeys", () => {
  it("préserve l'ordre d'insertion des clés non numériques", () => {
    expect(listDepenseKeys({ b: {}, a: {} })).toEqual(["b", "a"]);
  });

  it("rend un tableau vide sur une entrée non exploitable", () => {
    expect(listDepenseKeys(null)).toEqual([]);
    expect(listDepenseKeys(42)).toEqual([]);
  });
});
