import { describe, expect, it } from "vitest";
import {
  asRecord,
  getEntityId,
  getNonEmptyRecord,
  getServerData,
  normalizeIdOrNull,
  readEntityPreferences,
  toArray,
  toArrayOrValues,
  toNumber,
  toSafeInt,
  toString,
} from "./dataTransform";

describe("asRecord", () => {
  it("retourne {} pour null/undefined/primitives", () => {
    expect(asRecord(null)).toEqual({});
    expect(asRecord(undefined)).toEqual({});
    expect(asRecord(42)).toEqual({});
    expect(asRecord("hello")).toEqual({});
    expect(asRecord(true)).toEqual({});
  });

  it("retourne l'objet tel quel pour un objet", () => {
    const obj = { foo: "bar", n: 1 };
    expect(asRecord(obj)).toBe(obj);
  });

  it("retourne un tableau tel quel (typé Record)", () => {
    const arr = [1, 2, 3];
    expect(asRecord(arr)).toBe(arr as unknown as Record<string, unknown>);
  });
});

describe("getNonEmptyRecord", () => {
  it("retourne null pour non-objet ou objet vide", () => {
    expect(getNonEmptyRecord(null)).toBeNull();
    expect(getNonEmptyRecord(undefined)).toBeNull();
    expect(getNonEmptyRecord("string")).toBeNull();
    expect(getNonEmptyRecord({})).toBeNull();
  });

  it("retourne l'objet s'il contient au moins une clé", () => {
    const obj = { a: 1 };
    expect(getNonEmptyRecord(obj)).toBe(obj);
  });
});

describe("toArray", () => {
  it("pass-through pour les tableaux", () => {
    const arr = [1, 2, 3];
    expect(toArray(arr)).toBe(arr);
  });

  it("retourne [] pour null/undefined", () => {
    expect(toArray(null)).toEqual([]);
    expect(toArray(undefined)).toEqual([]);
  });

  it("wrappe les valeurs scalaires en [value]", () => {
    expect(toArray(42)).toEqual([42]);
    expect(toArray("hello")).toEqual(["hello"]);
    expect(toArray(false)).toEqual([false]);
  });

  it("wrappe les objets en [obj]", () => {
    const obj = { foo: "bar" };
    expect(toArray(obj)).toEqual([obj]);
  });
});

describe("toArrayOrValues", () => {
  it("pass-through pour les tableaux", () => {
    expect(toArrayOrValues([1, 2, 3])).toEqual([1, 2, 3]);
  });

  it("retourne Object.values pour un objet", () => {
    expect(toArrayOrValues({ a: 1, b: 2, c: 3 })).toEqual([1, 2, 3]);
  });

  it("retourne [] pour null/undefined/primitive", () => {
    expect(toArrayOrValues(null)).toEqual([]);
    expect(toArrayOrValues(undefined)).toEqual([]);
    expect(toArrayOrValues(42)).toEqual([]);
  });
});

describe("toNumber", () => {
  it("retourne le number si fini", () => {
    expect(toNumber(42)).toBe(42);
    expect(toNumber(3.14)).toBe(3.14);
    expect(toNumber(0)).toBe(0);
    expect(toNumber(-5)).toBe(-5);
  });

  it("retourne 0 pour Infinity / NaN", () => {
    expect(toNumber(Infinity)).toBe(0);
    expect(toNumber(NaN)).toBe(0);
  });

  it("parse les strings numériques", () => {
    expect(toNumber("42")).toBe(42);
    expect(toNumber("3.14")).toBe(3.14);
  });

  it("retourne 0 pour null/undefined/strings invalides", () => {
    expect(toNumber(null)).toBe(0);
    expect(toNumber(undefined)).toBe(0);
    expect(toNumber("not a number")).toBe(0);
  });
});

describe("toString", () => {
  it("retourne la string identique", () => {
    expect(toString("hello")).toBe("hello");
    expect(toString("")).toBe("");
  });

  it('retourne "" pour tout non-string', () => {
    expect(toString(42)).toBe("");
    expect(toString(null)).toBe("");
    expect(toString({ foo: "bar" })).toBe("");
    expect(toString(undefined)).toBe("");
  });
});

describe("getEntityId", () => {
  it("retourne la string si c'est une string", () => {
    expect(getEntityId("abc123")).toBe("abc123");
  });

  it("retourne '' pour null/undefined/primitives non-string", () => {
    expect(getEntityId(null)).toBe("");
    expect(getEntityId(undefined)).toBe("");
    expect(getEntityId(42)).toBe("");
  });

  it("extrait le .id direct", () => {
    expect(getEntityId({ id: "myId" })).toBe("myId");
  });

  it("extrait Mongo _id.$id", () => {
    expect(getEntityId({ _id: { $id: "mongoId" } })).toBe("mongoId");
  });

  it("extrait Mongo _id._str", () => {
    expect(getEntityId({ _id: { _str: "mongoStr" } })).toBe("mongoStr");
  });

  it("extrait $id à la racine", () => {
    expect(getEntityId({ $id: "rootDollarId" })).toBe("rootDollarId");
  });

  it("priorité : id > _id.$id > _id._str > $id", () => {
    expect(
      getEntityId({
        id: "winner",
        _id: { $id: "loser1", _str: "loser2" },
        $id: "loser3",
      }),
    ).toBe("winner");
  });

  it("retourne '' si aucun id trouvé", () => {
    expect(getEntityId({ foo: "bar" })).toBe("");
    expect(getEntityId({})).toBe("");
  });
});

describe("getServerData", () => {
  it("retourne _serverData en priorité", () => {
    const entity = {
      _serverData: { name: "from _serverData" },
      serverData: { name: "from serverData" },
    };
    expect(getServerData(entity)).toEqual({ name: "from _serverData" });
  });

  it("fallback sur serverData si _serverData absent ou vide", () => {
    expect(getServerData({ serverData: { name: "fallback" } })).toEqual({
      name: "fallback",
    });
    expect(getServerData({ _serverData: {}, serverData: { name: "ok" } })).toEqual({
      name: "ok",
    });
  });

  it("fallback sur le record direct si pas de serverData", () => {
    expect(getServerData({ name: "direct" })).toEqual({ name: "direct" });
  });

  it("retourne {} pour null/undefined/empty", () => {
    expect(getServerData(null)).toEqual({});
    expect(getServerData(undefined)).toEqual({});
    expect(getServerData({})).toEqual({});
  });
});

describe("readEntityPreferences", () => {
  it("lit entity.data.preferences", () => {
    const entity = { data: { preferences: { theme: "dark" } } };
    expect(readEntityPreferences(entity, "data")).toEqual({ theme: "dark" });
  });

  it("lit entity.serverData.preferences", () => {
    const entity = { serverData: { preferences: { theme: "light" } } };
    expect(readEntityPreferences(entity, "serverData")).toEqual({ theme: "light" });
  });

  it("retourne undefined si la source est absente", () => {
    expect(readEntityPreferences({ serverData: { name: "x" } }, "data")).toBeUndefined();
    expect(readEntityPreferences({}, "serverData")).toBeUndefined();
    expect(readEntityPreferences(null, "data")).toBeUndefined();
  });

  it("retourne undefined si preferences n'est pas un objet", () => {
    expect(readEntityPreferences({ data: { preferences: "string-pref" } }, "data")).toBeUndefined();
  });
});

describe("normalizeIdOrNull", () => {
  it("trim une string non-vide", () => {
    expect(normalizeIdOrNull("  abc  ")).toBe("abc");
    expect(normalizeIdOrNull("xyz")).toBe("xyz");
  });

  it('retourne null pour "" / espaces / non-string', () => {
    expect(normalizeIdOrNull("")).toBeNull();
    expect(normalizeIdOrNull("   ")).toBeNull();
    expect(normalizeIdOrNull(null)).toBeNull();
    expect(normalizeIdOrNull(undefined)).toBeNull();
    expect(normalizeIdOrNull(42)).toBeNull();
  });
});

describe("toSafeInt", () => {
  it("tronque les number finis", () => {
    expect(toSafeInt(42)).toBe(42);
    expect(toSafeInt(3.7)).toBe(3);
    expect(toSafeInt(-2.5)).toBe(-2);
    expect(toSafeInt(0)).toBe(0);
  });

  it("retourne 0 pour Infinity / NaN", () => {
    expect(toSafeInt(Infinity)).toBe(0);
    expect(toSafeInt(NaN)).toBe(0);
  });

  it("parse les strings (avec virgule décimale FR)", () => {
    expect(toSafeInt("42")).toBe(42);
    expect(toSafeInt("3,5")).toBe(3);
    expect(toSafeInt("1 234")).toBe(1234);
  });

  it("retourne 0 pour null/undefined/string invalide", () => {
    expect(toSafeInt(null)).toBe(0);
    expect(toSafeInt(undefined)).toBe(0);
    expect(toSafeInt("")).toBe(0);
    expect(toSafeInt("not a number")).toBe(0);
  });
});
