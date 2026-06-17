/**
 * Tests de la LOGIQUE du dashboard déclaratif : filtrage, formes de KPI,
 * décomptes des graphes, appairage layout, tri/cellules de table, alignement
 * prefetch ⇄ queryKey, et schéma de section (couleurs en jetons uniquement).
 * Tout est fonctions pures — le rendu est couvert par le test SSR réel.
 */
import { describe, it, expect } from "vitest";
import type { ChartDef, DimensionsConfig, ObservatoryItem } from "./schema";
import { DataObservatorySectionSchema } from "./schema";
import { dimensionLabel } from "./dimensions";
import {
  applyFilters,
  applyTextSearch,
  buildCsv,
  buildEntitiesCsv,
  buildRow,
  chartRows,
  chartTitle,
  colorFor,
  compare,
  computeKpiValue,
  itemsFor,
} from "./dashboard";
import { buildObservatoryBaseParams } from "./hooks/useObservatoryItemsQuery";
import { observatoryPrefetchParams } from "./prefetch";

/* ── Fixtures ────────────────────────────────────────────────────────────── */

const DIMS: DimensionsConfig = {
  ville: { paths: ["address.addressLocality"], label: { fr: "Ville", en: "City" } },
  type: { paths: ["type_name", "type"] },
  sports: { paths: ["aps"], kind: "list" },
  access: { paths: ["acc_a", "acc_b"], kind: "anyTrue" },
  surface: { paths: ["surf"], kind: "number" },
};

const items: ObservatoryItem[] = [
  { address: { addressLocality: "Cilaos" }, type_name: "Salle", aps: "Judo, Karaté", acc_a: "Oui", surf: "120" },
  { address: { addressLocality: "Cilaos" }, type: "Terrain", aps: ["Football"], acc_a: "false", surf: 300 },
  { address: { addressLocality: "Saint-Denis" }, type_name: "Salle", aps: "Judo", acc_b: 1 },
];

/* ── applyFilters ────────────────────────────────────────────────────────── */

describe("applyFilters", () => {
  it("value : égalité stricte ; list : appartenance ; anyTrue : oui/non", () => {
    expect(applyFilters(items, { ville: "Cilaos" }, DIMS)).toHaveLength(2);
    expect(applyFilters(items, { sports: "Judo" }, DIMS)).toHaveLength(2);
    expect(applyFilters(items, { access: "true" }, DIMS)).toHaveLength(2);
    expect(applyFilters(items, { access: "false" }, DIMS)).toHaveLength(1);
  });

  it("ET strict entre dimensions ; filtre vide ou dimension inconnue : ignorés", () => {
    expect(applyFilters(items, { ville: "Cilaos", sports: "Judo" }, DIMS)).toHaveLength(1);
    expect(applyFilters(items, { ville: "" }, DIMS)).toHaveLength(3);
    expect(applyFilters(items, { inconnue: "x" }, DIMS)).toHaveLength(3);
  });

  it("MULTI (valeurs jointes par virgule — format URL maison) : OU dans la dimension", () => {
    expect(applyFilters(items, { ville: "Cilaos,Saint-Denis" }, DIMS)).toHaveLength(3);
    expect(applyFilters(items, { type: "Salle,Terrain" }, DIMS)).toHaveLength(3);
    expect(applyFilters(items, { sports: "Karaté,Football" }, DIMS)).toHaveLength(2); // list : intersection
    expect(applyFilters(items, { ville: "Cilaos,Saint-Denis", sports: "Football" }, DIMS)).toHaveLength(1); // ET entre dims
  });
});

/* ── Recherche texte ─────────────────────────────────────────────────────── */

describe("applyTextSearch", () => {
  it("contains insensible casse/ACCENTS, OU entre dimensions, list incluses", () => {
    expect(applyTextSearch(items, "cilaos", DIMS)).toHaveLength(2);
    expect(applyTextSearch(items, "KARATE", DIMS)).toHaveLength(1); // Karaté sans accent
    expect(applyTextSearch(items, "saint", DIMS)).toHaveLength(1);
    expect(applyTextSearch(items, "introuvable", DIMS)).toHaveLength(0);
  });

  it("dimensions ciblées (props.search.dimensions) ; q vide → tout ; anyTrue/number exclus", () => {
    expect(applyTextSearch(items, "cilaos", DIMS, ["type"])).toHaveLength(0);
    expect(applyTextSearch(items, "  ", DIMS)).toHaveLength(3);
    expect(applyTextSearch(items, "120", DIMS)).toHaveLength(0); // surface (number) non cherchée
  });
});

/* ── KPI (5 formes) ──────────────────────────────────────────────────────── */

describe("computeKpiValue", () => {
  it("count / distinct / percentTrue / valueSplit / top", () => {
    expect(computeKpiValue({ kind: "count" }, items, DIMS)).toBe("3");
    expect(computeKpiValue({ kind: "distinct", dimension: "ville" }, items, DIMS)).toBe("2");
    expect(computeKpiValue({ kind: "percentTrue", dimension: "access" }, items, DIMS)).toBe("67%");
    expect(computeKpiValue({ kind: "valueSplit", dimension: "type", value: "Salle" }, items, DIMS)).toBe("2 / 1");
    expect(computeKpiValue({ kind: "top", dimension: "type" }, items, DIMS)).toBe("Salle");
  });

  it("dimension manquante → « — » ; dataset vide → 0 sans division par zéro", () => {
    expect(computeKpiValue({ kind: "distinct" }, items, DIMS)).toBe("—");
    expect(computeKpiValue({ kind: "top", dimension: "absente" }, items, DIMS)).toBe("—");
    expect(computeKpiValue({ kind: "percentTrue", dimension: "access" }, [], DIMS)).toBe("0%");
  });

  it("sum / avg : numériques uniquement, unité, locale fr, absents ignorés", () => {
    // surfaces présentes : "120" (coercée) et 300 — le 3ᵉ item n'en a pas.
    expect(computeKpiValue({ kind: "sum", dimension: "surface", unit: "m²" }, items, DIMS)).toBe("420 m²");
    expect(computeKpiValue({ kind: "avg", dimension: "surface" }, items, DIMS)).toBe("210");
    expect(computeKpiValue({ kind: "sum", dimension: "surface" }, [], DIMS)).toBe("—");
  });
});

/* ── Graphes ─────────────────────────────────────────────────────────────── */

describe("graphes (itemsFor / colorFor / chartTitle / chartRows)", () => {
  it("itemsFor : décomptes triés décroissants ; kind list aplati ; dimension inconnue → []", () => {
    expect(itemsFor({ kind: "donut", dimension: "type" }, items, DIMS)).toEqual([
      { name: "Salle", value: 2 },
      { name: "Terrain", value: 1 },
    ]);
    expect(itemsFor({ kind: "barsHorizontal", dimension: "sports" }, items, DIMS)).toEqual([
      { name: "Judo", value: 2 },
      { name: "Karaté", value: 1 },
      { name: "Football", value: 1 },
    ]);
    expect(itemsFor({ kind: "pie", dimension: "absente" }, items, DIMS)).toEqual([]);
  });

  it("colorFor : jeton déclaré → var(--…) ; sinon cycle catégoriel", () => {
    const def: ChartDef = { kind: "pie", dimension: "type", colors: { Salle: "chart-3" } };
    expect(colorFor(def, "Salle", 0)).toBe("var(--chart-3)");
    expect(colorFor(def, "Terrain", 1)).toBe("var(--chart-2)"); // cycle (index 1)
  });

  it("chartTitle : label (config) > labelKey > label de la dimension", () => {
    const t = (k: string | Record<string, string>) => (typeof k === "string" ? `i18n:${k}` : k.fr);
    expect(chartTitle({ kind: "pie", dimension: "ville", label: { fr: "Titre" } }, DIMS, t)).toBe("Titre");
    expect(chartTitle({ kind: "pie", dimension: "ville", labelKey: "x.y" }, DIMS, t)).toBe("i18n:x.y");
    expect(chartTitle({ kind: "pie", dimension: "ville" }, DIMS, t)).toBe("Ville");
    expect(dimensionLabel(t, DIMS, "type")).toBe("type"); // ni label ni labelKey → id
  });

  it("chartRows : les half consécutifs vont par deux, les full seuls", () => {
    const c = (layout?: "full" | "half"): ChartDef => ({ kind: "pie", dimension: "ville", layout });
    expect(chartRows([c("full"), c("half"), c("half"), c("full")]).map((r) => r.length)).toEqual([1, 2, 1]);
    expect(chartRows([c("half"), c("full"), c("half")]).map((r) => r.length)).toEqual([1, 1, 1]);
  });
});

/* ── Table ───────────────────────────────────────────────────────────────── */

describe("table (buildRow / compare)", () => {
  const columns = [
    { dimension: "ville", kind: "title" as const, subtitleDimension: "type" },
    { dimension: "surface", kind: "number" as const },
    { dimension: "access", kind: "boolBadge" as const },
  ];

  it("buildRow : résolution par kind (title+sous-titre, number, bool)", () => {
    const row = buildRow(items[0], 0, columns, DIMS);
    expect(row.cells.ville).toBe("Cilaos");
    expect(row.subtitles.ville).toBe("Salle");
    expect(row.cells.surface).toBe(120);
    expect(row.cells.access).toBe(true);
  });

  it("buildRow : cellule d'une dimension `list` = valeurs de l'axe (PAS le 1ᵉʳ tag brut)", () => {
    // sports = list sur "aps" : la cellule joint les valeurs de la liste, et
    // n'utilise PAS dimensionValue (qui prendrait le 1ᵉʳ élément brut seul).
    const cols = [{ dimension: "sports", kind: "badge" as const }];
    expect(buildRow(items[0], 0, cols, DIMS).cells.sports).toBe("Judo, Karaté");
    expect(buildRow(items[1], 1, cols, DIMS).cells.sports).toBe("Football");
  });

  it("compare : numérique (absent → en dernier en asc), booléen, chaîne locale fr", () => {
    const rows = items.map((e, i) => buildRow(e, i, columns, DIMS));
    const bySurface = [...rows].sort((a, b) => compare(a, b, columns[1]));
    expect(bySurface.map((r) => r.cells.surface)).toEqual([undefined, 120, 300]);
    const byAccess = [...rows].sort((a, b) => compare(a, b, columns[2]));
    expect(byAccess[0].cells.access).toBe(true); // true d'abord
  });
});

/* ── Export CSV ──────────────────────────────────────────────────────────── */

describe("buildCsv", () => {
  it("en-têtes, échappement des guillemets, booléens i18n, séparateur ;", () => {
    const columns = [
      { dimension: "ville" },
      { dimension: "surface", kind: "number" as const },
      { dimension: "access", kind: "boolBadge" as const },
    ];
    const rows = [
      {
        id: "r0",
        index: 0,
        cells: { ville: 'Saint "Le" Port', surface: 120, access: true },
        subtitles: {},
      },
    ];
    const csv = buildCsv(rows, columns, ["Ville", "Surface", "Accès"], { yes: "Oui", no: "Non" });
    expect(csv).toBe('"Ville";"Surface";"Accès"\n"Saint ""Le"" Port";120;"Oui"');
  });
});

/* ── buildEntitiesCsv (export COMPLET — MR#8) ────────────────────────────── */

describe("buildEntitiesCsv", () => {
  it("résout chaque champ DIRECTEMENT depuis l'item via le moteur de dimensions (value/number/bool)", () => {
    // Indépendant des colonnes du tableau : on passe des DimensionDef arbitraires.
    const fields = [DIMS.ville, DIMS.surface, DIMS.access];
    const csv = buildEntitiesCsv(items, fields, ["Ville", "Surface", "Accès"], { yes: "Oui", no: "Non" });
    expect(csv).toBe(
      [
        '"Ville";"Surface";"Accès"',
        '"Cilaos";120;"Oui"', // value quoté · number brut · bool→libellé i18n
        '"Cilaos";300;"Non"', // acc_a "false" → Non
        '"Saint-Denis";;"Oui"', // surf absent → cellule vide · acc_b 1 → Oui
      ].join("\n"),
    );
  });

  it("kind list → valeurs jointes par virgule", () => {
    const csv = buildEntitiesCsv([items[0]], [DIMS.sports], ["Sports"], { yes: "Oui", no: "Non" });
    expect(csv).toBe('"Sports"\n"Judo, Karaté"');
  });
});

/* ── baseParams partagés (hook ⇄ prefetch) ───────────────────────────────── */

describe("buildObservatoryBaseParams / observatoryPrefetchParams", () => {
  const baseParamsProp = { defaultFilters: { "source.key": "monDataset" } };

  it("défauts : poi, indexStepList 500, projection dérivée des dimensions, scopé au costum (pas de notSourceKey)", () => {
    const bp = buildObservatoryBaseParams(baseParamsProp, DIMS);
    expect(bp.defaultTypes).toEqual(["poi"]);
    // Le backend applique notSourceKey dès que le CHAMP est présent → on l'OMET
    // par défaut pour rester scopé au source.key du costum (comme searchProStatic).
    expect("notSourceKey" in bp).toBe(false);
    expect(bp.indexStepList).toBe(500);
    expect(bp.defaultFields).toContain("address"); // racine du chemin pointé
    expect(bp.defaultFields).toContain("collection"); // champ SDK
    expect(bp.defaultFields).toContain("acc_a");
  });

  it("notSourceKey explicite (réseau-wide) → champ inclus ; false/absent → omis", () => {
    expect("notSourceKey" in buildObservatoryBaseParams({ ...baseParamsProp, notSourceKey: true }, DIMS)).toBe(true);
    expect("notSourceKey" in buildObservatoryBaseParams({ ...baseParamsProp, notSourceKey: false }, DIMS)).toBe(false);
  });

  it("RÉGRESSION alignement SSR⇄client : le prefetch produit EXACTEMENT les baseParams du hook", () => {
    const params = observatoryPrefetchParams({ baseParams: baseParamsProp, dimensions: DIMS });
    expect(params).not.toBeNull();
    expect(params!.queryKeyPrefix).toBe("observatoire");
    // La queryKey React Query est structurelle : toute divergence ici casse
    // l'hydratation (refetch silencieux au lieu du cache SSR).
    expect(params!.baseParams).toEqual(buildObservatoryBaseParams(baseParamsProp, DIMS));
  });

  it("sans périmètre (defaultFilters) → null (pas de prefetch)", () => {
    expect(observatoryPrefetchParams({ dimensions: DIMS })).toBeNull();
    expect(observatoryPrefetchParams(undefined)).toBeNull();
  });
});

/* ── Schéma de section ───────────────────────────────────────────────────── */

describe("DataObservatorySectionSchema", () => {
  const valid = {
    type: "data-observatory",
    props: {
      baseParams: { defaultFilters: { "source.key": "x" } },
      dimensions: { ville: { paths: ["address.addressLocality"], label: { fr: "Ville" } } },
      filters: ["ville"],
      kpis: [{ kind: "count", label: { fr: "Total" }, icon: "activity", accent: "primary" }],
      charts: [{ kind: "pie", dimension: "ville", colors: { Cilaos: "chart-1" }, layout: "half" }],
      table: { columns: [{ dimension: "ville", kind: "title" }], defaultSort: "ville" },
    },
  };

  it("parse un bloc déclaratif complet", () => {
    expect(DataObservatorySectionSchema.safeParse(valid).success).toBe(true);
  });

  it("REJETTE les couleurs hors jetons de thème (hex interdits) et les formes inconnues", () => {
    const hex = structuredClone(valid);
    (hex.props.charts[0].colors as Record<string, string>).Cilaos = "#ff0000";
    expect(DataObservatorySectionSchema.safeParse(hex).success).toBe(false);

    const badKind = structuredClone(valid);
    (badKind.props.kpis[0] as { kind: string }).kind = "median";
    expect(DataObservatorySectionSchema.safeParse(badKind).success).toBe(false);
  });
});
