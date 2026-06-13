import { describe, it, expect } from "vitest";
import type { ObservatoryItem } from "./schema";
import {
  asDisplayString,
  dimensionBool,
  dimensionList,
  dimensionNumber,
  dimensionValue,
  fieldsFromDimensions,
  isTrue,
  isBoolKind,
  toNumber,
  toStringList,
} from "./dimensions";
import { countBy, uniqSorted } from "./utils";

/* ── Coercions tolérantes (formats API hétérogènes) ─────────────────────── */

describe("isTrue", () => {
  it("accepte les représentations affirmatives de l'API (bool, nombre, chaînes)", () => {
    expect(isTrue(true)).toBe(true);
    expect(isTrue(1)).toBe(true);
    expect(isTrue("true")).toBe(true);
    expect(isTrue("Oui")).toBe(true);
    expect(isTrue(" YES ")).toBe(true);
    expect(isTrue("1")).toBe(true);
  });

  it("rejette le reste (false, 0, null, undefined, autres chaînes)", () => {
    expect(isTrue(false)).toBe(false);
    expect(isTrue(0)).toBe(false);
    expect(isTrue(null)).toBe(false);
    expect(isTrue(undefined)).toBe(false);
    expect(isTrue("non")).toBe(false);
    expect(isTrue("")).toBe(false);
  });
});

describe("toStringList / toNumber / asDisplayString", () => {
  it("toStringList : CSV (virgule/point-virgule) et tableaux → liste plate", () => {
    expect(toStringList("Football, Basket ;Natation")).toEqual(["Football", "Basket", "Natation"]);
    expect(toStringList(["Judo", "", "Karaté"])).toEqual(["Judo", "Karaté"]);
    expect(toStringList(undefined)).toEqual([]);
  });

  it("toNumber : nombre, chaîne numérique ; sinon undefined", () => {
    expect(toNumber(42)).toBe(42);
    expect(toNumber("3.5")).toBe(3.5);
    expect(toNumber("abc")).toBeUndefined();
  });

  it("asDisplayString : chaîne, nombre, Date SDK (EJSON→Date), 1ᵉʳ élément de tableau", () => {
    expect(asDisplayString("ok")).toBe("ok");
    expect(asDisplayString(2024)).toBe("2024");
    // Le SDK désérialise les dates EJSON Mongo en Date — affichage ISO court.
    expect(asDisplayString(new Date("2026-01-15T10:00:00Z"))).toBe("2026-01-15");
    expect(asDisplayString(["", "premier"])).toBe("premier");
    expect(asDisplayString("")).toBeUndefined();
    expect(asDisplayString(null)).toBeUndefined();
  });
});

/* ── Moteur de dimensions (cœur déclaratif) ──────────────────────────────── */

describe("moteur de dimensions", () => {
  const e: ObservatoryItem = {
    address: { addressLocality: "Cilaos" },
    equip_type_famille: "Salle",
    aps_csv: "Judo, Karaté",
    flag_a: "false",
    flag_b: "Oui",
    surf_txt: "120",
    maj: new Date("2026-02-01T00:00:00Z"),
  };

  it("value : chaîne de priorité + chemins pointés + dates SDK", () => {
    expect(dimensionValue(e, { paths: ["address.addressLocality"] })).toBe("Cilaos");
    expect(dimensionValue(e, { paths: ["equip_type_name", "equip_type_famille"] })).toBe("Salle");
    expect(dimensionValue(e, { paths: ["maj"] })).toBe("2026-02-01");
    expect(dimensionValue(e, { paths: ["absent"] })).toBeUndefined();
  });

  it("list : CSV aplati ; anyTrue : au moins un chemin affirmatif ; number : coercion", () => {
    expect(dimensionList(e, { paths: ["aps_csv"], kind: "list" })).toEqual(["Judo", "Karaté"]);
    expect(dimensionBool(e, { paths: ["flag_a", "flag_b"], kind: "anyTrue" })).toBe(true);
    expect(dimensionBool(e, { paths: ["flag_a"], kind: "anyTrue" })).toBe(false);
    expect(dimensionNumber(e, { paths: ["surf_txt"], kind: "number" })).toBe(120);
  });

  it("list + values : décompose un champ fourre-tout en axe orthogonal (ordre déclaré)", () => {
    const tl: ObservatoryItem = {
      tags: ["TiersLieux", "Bureaux partagés / Coworking", "Association", "Plus de 200m²"],
    };
    const TYPO = ["Bureaux partagés / Coworking", "Fablab", "Tiers-lieu culturel"];
    // ne garde que les valeurs de l'allowlist présentes — pas les tags hors-axe
    expect(dimensionList(tl, { paths: ["tags"], kind: "list", values: TYPO })).toEqual([
      "Bureaux partagés / Coworking",
    ]);
    // ordre = ordre DÉCLARÉ (stable pour les charts), pas l'ordre du tableau source
    const multi: ObservatoryItem = { tags: ["Fablab", "Bureaux partagés / Coworking"] };
    expect(dimensionList(multi, { paths: ["tags"], kind: "list", values: TYPO })).toEqual([
      "Bureaux partagés / Coworking",
      "Fablab",
    ]);
  });

  it("contains : booléen d'appartenance à une liste (ex. label)", () => {
    const tl: ObservatoryItem = { tags: ["TiersLieux", "Compagnon France Tiers-Lieux"] };
    const def = { paths: ["tags"], kind: "contains" as const, value: "Compagnon France Tiers-Lieux" };
    expect(dimensionBool(tl, def)).toBe(true);
    expect(dimensionBool({ tags: ["TiersLieux"] }, def)).toBe(false);
    expect(isBoolKind("contains")).toBe(true);
    expect(isBoolKind("anyTrue")).toBe(true);
    expect(isBoolKind("list")).toBe(false);
  });
});

/* ── Projection dérivée des dimensions ───────────────────────────────────── */

describe("fieldsFromDimensions", () => {
  it("racines des chemins + champs SDK (_linkEntities), dédupliqués", () => {
    const fields = fieldsFromDimensions({
      commune: { paths: ["address.addressLocality"] },
      epci: { paths: ["address.level5Name"] },
      type: { paths: ["equip_type_name", "type"] },
    });
    expect(fields).toContain("collection");
    expect(fields).toContain("_id");
    expect(fields).toContain("slug");
    expect(fields).toContain("address"); // racine du chemin pointé, UNE fois
    expect(fields).toContain("equip_type_name");
    expect(fields.filter((f) => f === "address")).toHaveLength(1);
  });
});

/* ── Agrégations ─────────────────────────────────────────────────────────── */

describe("countBy / uniqSorted", () => {
  it("countBy compte par clé et ignore les undefined", () => {
    const out = countBy(["a", "b", "a", undefined as unknown as string], (x) => x);
    expect(out).toEqual([
      { name: "a", value: 2 },
      { name: "b", value: 1 },
    ]);
  });

  it("uniqSorted déduplique, vire les vides et trie en locale fr", () => {
    expect(uniqSorted(["Étang-Salé", "Cilaos", undefined, "", "Cilaos"])).toEqual([
      "Cilaos",
      "Étang-Salé",
    ]);
  });
});
