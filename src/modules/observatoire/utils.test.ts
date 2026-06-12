import { describe, it, expect } from "vitest";
import { EquipmentSchema } from "./schema";
import type { Equipment } from "./schema";
import {
  RES_DIMENSIONS,
  dimensionBool,
  dimensionList,
  dimensionNumber,
  dimensionValue,
  mergedDimensions,
} from "./dimensions";
import {
  NATURE_VALUES,
  countBy,
  firstString,
  getEpci,
  getInstName,
  getType,
  isIndoor,
  isPmrAccessible,
  isPshsAccessible,
  isTrue,
  normalizeAps,
  toNumber,
  uniqSorted,
} from "./utils";

/* ── Moteur de dimensions (cœur déclaratif) ──────────────────────────────── */

describe("moteur de dimensions", () => {
  const e = {
    address: { addressLocality: "Cilaos" },
    equip_type_famille: "Salle",
    aps_csv: "Judo, Karaté",
    flag_a: "false",
    flag_b: "Oui",
    surf_txt: "120",
  } as unknown as Equipment;

  it("value : chaîne de priorité + chemins pointés", () => {
    expect(dimensionValue(e, { paths: ["address.addressLocality"] })).toBe("Cilaos");
    expect(dimensionValue(e, { paths: ["equip_type_name", "equip_type_famille"] })).toBe("Salle");
    expect(dimensionValue(e, { paths: ["absent"] })).toBeUndefined();
  });

  it("list : CSV aplati ; anyTrue : au moins un chemin affirmatif ; number : coercion", () => {
    expect(dimensionList(e, { paths: ["aps_csv"], kind: "list" })).toEqual(["Judo", "Karaté"]);
    expect(dimensionBool(e, { paths: ["flag_a", "flag_b"], kind: "anyTrue" })).toBe(true);
    expect(dimensionBool(e, { paths: ["flag_a"], kind: "anyTrue" })).toBe(false);
    expect(dimensionNumber(e, { paths: ["surf_txt"], kind: "number" })).toBe(120);
  });

  it("mergedDimensions : surcharge ATOMIQUE par dimension, preset conservé ailleurs", () => {
    const merged = mergedDimensions({ commune: { paths: ["ville"] } });
    expect(merged.commune.paths).toEqual(["ville"]);
    expect(merged.type).toBe(RES_DIMENSIONS.type);
  });
});

/* ── Schéma Equipment (formats serverData hétérogènes) ──────────────────── */

describe("EquipmentSchema", () => {
  it("RÉGRESSION : accepte les dates normalisées en objets Date par le SDK (EJSON)", () => {
    // Constaté en réel : 418 équipements silencieusement rejetés quand les
    // trois champs de date arrivaient en Date au lieu de string.
    const parsed = EquipmentSchema.safeParse({
      equip_nom: "Stade de l'Est",
      inst_date_creation: new Date(0),
      inst_enqu_date: "2020-01-01",
      equip_maj_date: new Date(0),
    });
    expect(parsed.success).toBe(true);
  });
});

/* ── Coercions tolérantes (formats API RES hétérogènes) ─────────────────── */

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

describe("normalizeAps", () => {
  it("string CSV (virgule ou point-virgule) → tableau nettoyé", () => {
    expect(normalizeAps("Football, Basket ;Natation")).toEqual(["Football", "Basket", "Natation"]);
  });

  it("tableau → filtré des vides ; absent → []", () => {
    expect(normalizeAps(["Judo", "", "Karaté"])).toEqual(["Judo", "Karaté"]);
    expect(normalizeAps(undefined)).toEqual([]);
  });
});

describe("firstString / toNumber", () => {
  it("firstString : première chaîne non vide, y compris dans des tableaux", () => {
    expect(firstString(undefined, "", ["", "ok"], "après")).toBe("ok");
    expect(firstString(undefined, "")).toBeUndefined();
  });

  it("toNumber : nombre, chaîne numérique ; sinon undefined", () => {
    expect(toNumber(42)).toBe(42);
    expect(toNumber("3.5")).toBe(3.5);
    expect(toNumber("abc")).toBeUndefined();
    expect(toNumber("")).toBeUndefined();
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

/* ── Accès aux dimensions RES ────────────────────────────────────────────── */

const equipment = (overrides: Record<string, unknown>): Equipment =>
  overrides as Equipment;

describe("dimensions Equipment", () => {
  it("getType suit la chaîne de priorité equip_type_name → famille → type → categorie", () => {
    expect(getType(equipment({ equip_type_name: "Gymnase", type: "x" }))).toBe("Gymnase");
    expect(getType(equipment({ categorie: "Salle" }))).toBe("Salle");
  });

  it("getEpci lit address.level5Name ; getInstName retombe sur equip_nom puis —", () => {
    expect(getEpci(equipment({ address: { level5Name: "CINOR" } }))).toBe("CINOR");
    expect(getInstName(equipment({ equip_nom: "Stade Est" }))).toBe("Stade Est");
    expect(getInstName(equipment({}))).toBe("—");
  });

  it("isIndoor compare au vocabulaire RES centralisé (NATURE_VALUES.INDOOR)", () => {
    expect(isIndoor(equipment({ equip_nature: NATURE_VALUES.INDOOR }))).toBe(true);
    expect(isIndoor(equipment({ equip_nature: NATURE_VALUES.OUTDOOR }))).toBe(false);
    expect(isIndoor(equipment({}))).toBe(false);
  });

  it("isPmrAccessible / isPshsAccessible : vrai dès qu'UN champ du groupe l'est (formats mixtes)", () => {
    expect(isPmrAccessible(equipment({ equip_pmr_douche: "Oui" }))).toBe(true);
    expect(isPmrAccessible(equipment({ equip_pmr_acc: "false" }))).toBe(false);
    expect(isPshsAccessible(equipment({ equip_pshs_sign: 1 }))).toBe(true);
    expect(isPshsAccessible(equipment({}))).toBe(false);
  });
});
