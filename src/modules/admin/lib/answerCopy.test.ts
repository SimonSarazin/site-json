import { describe, it, expect } from "vitest";
import { buildCopyIndex, copyStatusOf, DEFAULT_DUPLICATE_KEYS, rowId, rowSignature } from "./answerCopy";

/**
 * Trois états décident de ce que l'admin PEUT faire (copier, confirmer, rien) : la trace
 * `copiedFrom` doit l'emporter sur l'empreinte, une empreinte vide ne doit jamais matcher, et
 * l'id doit se lire sous toutes ses sérialisations — sinon un créneau déjà repris redevient
 * « À copier » et l'admin le duplique en toute bonne foi.
 */
const KEYS = DEFAULT_DUPLICATE_KEYS;
const row = (id: string, data: Record<string, unknown>) => ({ id, serverData: data });

describe("rowId — sérialisations de l'_id", () => {
  it("préfère l'id d'instance, puis serverData.id, puis _id.$id / _id._str / chaîne", () => {
    expect(rowId({ id: "a", serverData: { id: "b" } })).toBe("a");
    expect(rowId({ serverData: { id: "b" } })).toBe("b");
    expect(rowId({ serverData: { _id: { $id: "c" } } })).toBe("c");
    expect(rowId({ serverData: { _id: { _str: "d" } } })).toBe("d");
    expect(rowId({ serverData: { _id: "e" } })).toBe("e");
  });

  it("chaîne vide sans identifiant exploitable (jamais 'undefined')", () => {
    expect(rowId({})).toBe("");
    expect(rowId(null)).toBe("");
    expect(rowId({ serverData: { _id: {} } })).toBe("");
  });
});

describe("rowSignature — empreinte normalisée", () => {
  it("replie casse et espaces ; l'ordre des clés est celui de la config", () => {
    const a = rowSignature(row("1", { name: "GYM  Douce ", structure: { name: "Mairie" }, address: { postalCode: "97430" } }), KEYS);
    const b = rowSignature(row("2", { name: "gym douce", structure: { name: "MAIRIE" }, address: { postalCode: 97430 } }), KEYS);
    expect(a).toBe(b);
  });

  it("null quand aucune clé n'a de valeur — deux lignes vides ne se ressemblent pas", () => {
    expect(rowSignature(row("1", {}), KEYS)).toBeNull();
    expect(rowSignature(row("1", { name: "", structure: { name: null } }), KEYS)).toBeNull();
  });

  it("une clé partielle suffit à faire une empreinte (nom seul)", () => {
    expect(rowSignature(row("1", { name: "Pilates" }), KEYS)).not.toBeNull();
  });
});

describe("buildCopyIndex / copyStatusOf", () => {
  const target = [
    row("c1", { copiedFrom: "s1", name: "Pilates", structure: { name: "Mairie" }, address: { postalCode: "97430" } }),
    row("c2", { name: "Zumba", structure: { name: "Mairie" }, address: { postalCode: "97418" } }), // sans trace
    row("c3", {}), // vide : jamais une empreinte
  ];
  const index = buildCopyIndex(target, KEYS);

  it("la trace copiedFrom → « copied » avec l'id de la copie", () => {
    const s1 = row("s1", { name: "Autre nom", structure: { name: "X" }, address: { postalCode: "97400" } });
    expect(copyStatusOf(s1, index, KEYS)).toEqual({ status: "copied", copyId: "c1" });
  });

  it("une cible sans trace qui partage l'empreinte → « probable »", () => {
    const s2 = row("s2", { name: " zumba", structure: { name: "mairie" }, address: { postalCode: "97418" } });
    expect(copyStatusOf(s2, index, KEYS)).toEqual({ status: "probable" });
  });

  it("une cible TRACÉE alimente aussi les empreintes : un second dépôt homonyme → « probable »", () => {
    const homonyme = row("s9", { name: "Pilates", structure: { name: "Mairie" }, address: { postalCode: "97430" } });
    expect(copyStatusOf(homonyme, index, KEYS)).toEqual({ status: "probable" });
  });

  it("l'empreinte est séparée : des découpages différents ne collisionnent pas", () => {
    const a = rowSignature(row("1", { name: "gym 9", structure: { name: "7430 x" } }), ["name", "structure.name"]);
    const b = rowSignature(row("2", { name: "gym", structure: { name: "97430 x" } }), ["name", "structure.name"]);
    expect(a).not.toBe(b);
  });

  it("aucune correspondance → « new » ; une candidate vide ne matche pas la cible vide", () => {
    expect(copyStatusOf(row("s3", { name: "Marche" }), index, KEYS)).toEqual({ status: "new" });
    expect(copyStatusOf(row("s4", {}), index, KEYS)).toEqual({ status: "new" });
  });

  it("la trace l'emporte sur l'empreinte quand les deux existent", () => {
    const both = buildCopyIndex(
      [row("c1", { copiedFrom: "s1", name: "A" }), row("c2", { name: "A" })],
      ["name"],
    );
    expect(copyStatusOf(row("s1", { name: "A" }), both, ["name"])).toEqual({ status: "copied", copyId: "c1" });
  });
});
