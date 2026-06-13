import { describe, it, expect } from "vitest";
import type { ObservatoryItem } from "./schema";
import {
  asDisplayString,
  buildLabelMaps,
  dimensionBool,
  dimensionList,
  dimensionNumber,
  dimensionValue,
  fieldsFromDimensions,
  isTrue,
  isBoolKind,
  pickCanonicalLabel,
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
    // dédup : un item pèse 1 par valeur distincte (pas de sur-comptage)
    expect(dimensionList({ t: ["Wifi", "PMR", "Wifi"] }, { paths: ["t"], kind: "list" })).toEqual(["Wifi", "PMR"]);
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

  it("valueMap : normalise les variantes backend → canonique (value ET list)", () => {
    const SURF = ["Plus de 200m²", "Entre 60 et 200m²"];
    const MAP = { "Plus de 200m2": "Plus de 200m²", "Entre 60m² et 200m²": "Entre 60 et 200m²" };
    // list : les 2 variantes d'un même item fusionnent en UNE valeur canonique
    const it1: ObservatoryItem = { tags: ["Plus de 200m2", "TiersLieux"] };
    expect(dimensionList(it1, { paths: ["tags"], kind: "list", values: SURF, valueMap: MAP })).toEqual([
      "Plus de 200m²",
    ]);
    // dédoublonne si l'item porte la variante ET la canonique
    const it2: ObservatoryItem = { tags: ["Plus de 200m2", "Plus de 200m²"] };
    expect(dimensionList(it2, { paths: ["tags"], kind: "list", values: SURF, valueMap: MAP })).toEqual([
      "Plus de 200m²",
    ]);
    // value : normalisation aussi
    expect(dimensionValue({ p: "Switzerland" }, { paths: ["p"], valueMap: { Switzerland: "Suisse" } })).toBe("Suisse");
  });

  it("chemin array-aware : lit une RÉPONSE CoForm imbriquée (answers[form][N].serverData.answers)", () => {
    // Structure réelle navigator-tl : answers[form] est un TABLEAU d'entités
    // Answer ; chacune porte serverData.answers.<section>.<field>. Le résolveur
    // array-aware mappe le reste du chemin sur chaque entité puis aplatit — une
    // réponse CoForm se lit par un simple `paths`, sans accesseur dédié.
    const PATH = "answers.formA.serverData.answers.sectionX.eq_field";
    const tl: ObservatoryItem = {
      answers: {
        formA: [
          {
            serverData: {
              answers: {
                sectionX: { eq_field: ["Wifi", "Vidéoprojecteur", "PMR"] },
              },
            },
          },
        ],
      },
    };
    // list : la réponse traversée est traitée comme une dimension list normale
    expect(dimensionList(tl, { paths: [PATH], kind: "list" })).toEqual([
      "Wifi",
      "Vidéoprojecteur",
      "PMR",
    ]);
    // contains : appartenance dans la réponse
    expect(dimensionBool(tl, { paths: [PATH], kind: "contains", value: "Wifi" })).toBe(true);
    expect(dimensionBool(tl, { paths: [PATH], kind: "contains", value: "Bar" })).toBe(false);
    // index numérique explicite → cible une entité précise du tableau (pas de map)
    expect(
      dimensionList(tl, { paths: ["answers.formA.0.serverData.answers.sectionX.eq_field"], kind: "list" }),
    ).toEqual(["Wifi", "Vidéoprojecteur", "PMR"]);
    // multi-soumissions : answers[form] a PLUSIEURS entités → les valeurs
    // concaténées sont DÉDUPLIQUÉES (un item pèse 1 par valeur distincte, pas de
    // sur-comptage dans les graphes), ordre d'apparition préservé.
    const multi: ObservatoryItem = {
      answers: {
        formA: [
          { serverData: { answers: { sectionX: { eq_field: ["Wifi", "PMR"] } } } },
          { serverData: { answers: { sectionX: { eq_field: ["PMR", "Bar"] } } } },
        ],
      },
    };
    expect(dimensionList(multi, { paths: [PATH], kind: "list" })).toEqual(["Wifi", "PMR", "Bar"]);
    // champ absent → vide (item non répondu)
    expect(dimensionList({}, { paths: [PATH], kind: "list" })).toEqual([]);
    // fieldsFromDimensions ramène la racine `answers` (sous-document embarqué)
    expect(fieldsFromDimensions({ eq: { paths: [PATH], kind: "list" } })).toContain("answers");
  });

  it("keyPaths : regroupe sur clé canonique propre, libellé canonique dérivé du dataset", () => {
    // Données SALES : level4Name varie en casse/accents pour un MÊME département
    // (clé propre = level4, l'id de zone stable).
    const data: ObservatoryItem[] = [
      { address: { level4: "id-nord", level4Name: "NORD" } },
      { address: { level4: "id-nord", level4Name: "Nord" } },
      { address: { level4: "id-isere", level4Name: "ISERE" } },
      { address: { level4: "id-isere", level4Name: "Isère" } },
      { address: { level4: "id-isere", level4Name: "ISèRE" } },
      { address: { level4: "id-reunion", level4Name: "RÉUNION" } },
      { address: { level4: "id-reunion", level4Name: "La Réunion" } },
      { address: { level4: "id-paris", level4Name: "PARIS" } }, // que du MAJUSCULE → Title Case
    ];
    const dep = { paths: ["address.level4Name"], keyPaths: ["address.level4"] };
    const maps = buildLabelMaps(data, { departement: dep });
    const m = maps.departement;
    // libellé canonique = variante la plus « riche » (casse mixte + accents)
    expect(m.get("id-nord")).toBe("Nord");
    expect(m.get("id-isere")).toBe("Isère");
    // "La Réunion" (mixte+accent) gagne sur "RÉUNION"
    expect(m.get("id-reunion")).toBe("La Réunion");
    // tout-majuscule → repli Title Case
    expect(m.get("id-paris")).toBe("Paris");
    // dimensionValue REGROUPE : deux items du même dept → MÊME valeur canonique
    expect(dimensionValue(data[0], dep, m)).toBe("Nord");
    expect(dimensionValue(data[1], dep, m)).toBe("Nord");
    expect(dimensionValue(data[2], dep, m)).toBe("Isère");
    // sans la map (legacy/back-compat) : repli sur le chemin brut (sale)
    expect(dimensionValue(data[0], dep)).toBe("NORD");
    // fieldsFromDimensions projette la racine de keyPaths (address) ET de paths
    expect(fieldsFromDimensions({ departement: dep })).toContain("address");
  });

  it("pickCanonicalLabel : variante propre préférée, sinon Title Case fr (particules)", () => {
    expect(pickCanonicalLabel(["RÉUNION", "RéUNION", "Réunion", "reunion"])).toBe("Réunion");
    expect(pickCanonicalLabel(["ISERE", "ISèRE", "Isère"])).toBe("Isère");
    expect(pickCanonicalLabel(["NORD", "Nord"])).toBe("Nord");
    // aucune variante propre → Title Case fr (particules en minuscule)
    expect(pickCanonicalLabel(["LOIRE-ATLANTIQUE"])).toBe("Loire-Atlantique");
    expect(pickCanonicalLabel(["CORSE-DU-SUD"])).toBe("Corse-du-Sud");
    expect(pickCanonicalLabel(["VAL-D'OISE"])).toBe("Val-d'Oise");
    // casse interne sale sans variante propre → réparée par Title Case
    expect(pickCanonicalLabel(["ARIèGE", "ARIEGE"])).toBe("Ariège");
    // variante DÉJÀ propre (casse) → gardée telle quelle, pas de re-Title-Case
    expect(pickCanonicalLabel(["CÔTES-D'ARMOR", "Côtes-d'Armor"])).toBe("Côtes-d'Armor");
    expect(pickCanonicalLabel([])).toBe("");
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
