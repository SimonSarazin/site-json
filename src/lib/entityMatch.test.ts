import { describe, it, expect, vi } from "vitest";
import { entityMatchData, firstMatching, getSourceKey, getSourceKeys } from "./entityMatch";

/** Entité SDK minimale : ce que le rendu voit réellement (instance avec `serverData`). */
const entity = (serverData: Record<string, unknown>, entityType?: string) => ({
  serverData,
  ...(entityType ? { getEntityType: () => entityType } : {}),
});

describe("getSourceKey / getSourceKeys", () => {
  it("lit la clé primaire, et rien d'autre", () => {
    const e = entity({ source: { key: "parent62", keys: ["autre"] } });
    expect(getSourceKey(e)).toBe("parent62");
    expect(getSourceKeys(e)).toEqual(["parent62", "autre"]);
  });

  it("normalise `source.keys` en OBJET À TROUS (byte-parité `unset` PHP)", () => {
    const e = entity({ source: { key: "parent62", keys: { "0": "a", "2": "b" } } });
    expect(getSourceKeys(e)).toEqual(["parent62", "a", "b"]);
  });

  it("dédoublonne, ignore les valeurs vides, tolère l'absence de `source`", () => {
    expect(getSourceKeys(entity({ source: { key: "x", keys: ["x", "", "y"] } }))).toEqual(["x", "y"]);
    expect(getSourceKeys(entity({}))).toEqual([]);
    expect(getSourceKey(entity({}))).toBeUndefined();
    expect(getSourceKey(entity({ source: { key: "" } }))).toBeUndefined();
  });
});

describe("entityMatchData", () => {
  it("expose `collection` depuis serverData, avec repli sur getEntityType()", () => {
    expect(entityMatchData(entity({ collection: "poi" })).collection).toBe("poi");
    expect(entityMatchData(entity({}, "events")).collection).toBe("events");
  });

  it("expose les champs synthétiques sourceKey / sourceKeys", () => {
    const data = entityMatchData(entity({ source: { key: "parent62", keys: { "0": "reseau" } } }));
    expect(data.sourceKey).toBe("parent62");
    expect(data.sourceKeys).toEqual(["parent62", "reseau"]);
  });

  it("résout les chemins pointés, et rend `undefined` sur un champ absent (sans throw)", () => {
    const data = entityMatchData(entity({ address: { addressLocality: "Arras" } }));
    expect(data["address.addressLocality"]).toBe("Arras");
    expect(data["address.postalCode"]).toBeUndefined();
    expect(data["absent.totalement"]).toBeUndefined();
    expect(data.absent).toBeUndefined();
  });
});

describe("firstMatching", () => {
  const data = entityMatchData(entity({ collection: "poi", type: "affiche" }));

  it("renvoie la PREMIÈRE règle qui matche", () => {
    const rules = [
      { id: "a", when: { field: "type", op: "eq", value: "article" } },
      { id: "b", when: { field: "type", op: "eq", value: "affiche" } },
      { id: "c", when: { field: "collection", op: "eq", value: "poi" } },
    ];
    expect(firstMatching(rules, data)?.id).toBe("b");
  });

  it("une règle SANS `when` est un catch-all — en tête, elle masque toutes les suivantes", () => {
    expect(firstMatching([{ id: "fallback" }, { id: "b", when: { field: "type", op: "eq", value: "affiche" } }], data)?.id).toBe("fallback");
    expect(firstMatching([{ id: "b", when: { field: "type", op: "eq", value: "affiche" } }, { id: "fallback" }], data)?.id).toBe("b");
  });

  it("aucune règle / liste vide → undefined", () => {
    expect(firstMatching([{ when: { field: "type", op: "eq", value: "article" } }], data)).toBeUndefined();
    expect(firstMatching([], data)).toBeUndefined();
    expect(firstMatching(undefined, data)).toBeUndefined();
  });

  it("une règle malformée est IGNORÉE et signalée — l'évaluation continue, rien ne throw", () => {
    const onError = vi.fn();
    const rules = [
      { id: "regex-invalide", when: { field: "type", op: "matches", value: "([" } },
      { id: "valide", when: { field: "type", op: "eq", value: "affiche" } },
    ];
    expect(firstMatching(rules, data, onError)?.id).toBe("valide");
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][1]).toMatchObject({ id: "regex-invalide" });
  });
});
