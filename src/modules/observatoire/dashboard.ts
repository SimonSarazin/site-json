// ------------------------------------------------------------
// dashboard.ts — logique PURE du dashboard déclaratif
// ------------------------------------------------------------
// Filtrage, formes de KPI, décomptes/couleurs/titres/agencement des graphes,
// lignes et tri de la table. Séparée des composants (présentation) : testable
// sans rendu (dashboard.test.ts) et compatible Fast Refresh (les fichiers de
// composants n'exportent que des composants).
// ------------------------------------------------------------
import type {
  ChartDef,
  DimensionDef,
  DimensionsConfig,
  FilterValues,
  KpiDef,
  ObservatoryItem,
  TableColumnDef,
} from "./schema";
import {
  BOOL_FILTER_VALUES,
  TOKEN_CSS_VARS,
  dimensionBool,
  isBoolKind,
  dimensionLabel,
  dimensionList,
  dimensionNumber,
  dimensionValue,
  type LabelMaps,
} from "./dimensions";
import { countBy } from "./utils";

export const PLACEHOLDER = "—";

type T = (key: string | Record<string, string>, fallback?: string) => string;

/*───────────────────────────────────────────────────────────────*/
/* Filtrage                                                      */
/*───────────────────────────────────────────────────────────────*/

/**
 * Filtrage CLIENT générique : ET strict entre dimensions, sémantique par
 * `kind` (value : égalité · list : appartenance · anyTrue : oui/non).
 * Côté client par design : le dashboard agrège tout le dataset en mémoire —
 * filtrer serveur signifierait tout recharger à chaque clic (le module
 * search reste le bon outil pour les LISTES paginées filtrées serveur).
 */
export function applyFilters(
  data: ObservatoryItem[],
  f: FilterValues,
  dims: DimensionsConfig,
  labels?: LabelMaps,
): ObservatoryItem[] {
  const active = Object.entries(f).filter(([id, v]) => v && dims[id]);
  if (active.length === 0) return data;
  return data.filter((d) =>
    active.every(([id, v]) => {
      const def = dims[id];
      if (isBoolKind(def.kind)) {
        return dimensionBool(d, def) === (v === BOOL_FILTER_VALUES.TRUE);
      }
      // Multi-sélection : valeurs jointes par virgule (format URL maison —
      // une virgule signifie TOUJOURS multi, interdite dans une valeur).
      // OU entre les valeurs d'une dimension, ET entre dimensions.
      const selected = v.split(",").map((s) => s.trim()).filter(Boolean);
      if (def.kind === "list") {
        const own = dimensionList(d, def);
        return selected.some((s) => own.includes(s));
      }
      const value = dimensionValue(d, def, labels?.[id]);
      return value !== undefined && selected.includes(value);
    }),
  );
}

/*───────────────────────────────────────────────────────────────*/
/* Recherche texte                                               */
/*───────────────────────────────────────────────────────────────*/

/** Normalisation pour le matching : minuscules, sans accents. */
function normalizeText(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/**
 * Recherche TEXTE côté client : `contains` insensible casse/accents sur les
 * dimensions désignées (défaut : toutes les dimensions value/list — les
 * anyTrue/number n'ont pas de texte pertinent). OU entre dimensions.
 */
export function applyTextSearch(
  data: ObservatoryItem[],
  q: string,
  dims: DimensionsConfig,
  searchDimIds?: readonly string[],
  labels?: LabelMaps,
): ObservatoryItem[] {
  const needle = normalizeText(q.trim());
  if (!needle) return data;
  const ids = (searchDimIds?.length ? searchDimIds : Object.keys(dims)).filter(
    (id) => {
      const kind = dims[id]?.kind;
      return dims[id] && !isBoolKind(kind) && kind !== "number";
    },
  );
  return data.filter((d) =>
    ids.some((id) => {
      const def = dims[id];
      if (def.kind === "list") {
        return dimensionList(d, def).some((v) => normalizeText(v).includes(needle));
      }
      const v = dimensionValue(d, def, labels?.[id]);
      return v !== undefined && normalizeText(v).includes(needle);
    }),
  );
}

/*───────────────────────────────────────────────────────────────*/
/* KPI                                                           */
/*───────────────────────────────────────────────────────────────*/

/** Calcule la valeur d'un KPI déclaratif (formes : count/distinct/percentTrue/valueSplit/top). */
export function computeKpiValue(
  def: KpiDef,
  data: ObservatoryItem[],
  dims: DimensionsConfig,
  labels?: LabelMaps,
): string {
  const total = data.length;
  const dim = def.dimension ? dims[def.dimension] : undefined;
  const dimLabels = def.dimension ? labels?.[def.dimension] : undefined;
  switch (def.kind) {
    case "count":
      return String(total);
    case "distinct": {
      if (!dim) return PLACEHOLDER;
      const set = new Set(
        data.map((d) => dimensionValue(d, dim, dimLabels)).filter(Boolean),
      );
      return String(set.size);
    }
    case "percentTrue": {
      if (!dim) return PLACEHOLDER;
      const n = data.filter((d) => dimensionBool(d, dim)).length;
      return total ? `${Math.round((n / total) * 100)}%` : "0%";
    }
    case "valueSplit": {
      if (!dim || !def.value) return PLACEHOLDER;
      const n = data.filter((d) => dimensionValue(d, dim, dimLabels) === def.value).length;
      return `${n} / ${total - n}`;
    }
    case "top": {
      if (!dim) return PLACEHOLDER;
      const counts = countBy(data, (d) => dimensionValue(d, dim, dimLabels));
      return counts.sort((a, b) => b.value - a.value)[0]?.name ?? PLACEHOLDER;
    }
    case "sum":
    case "avg": {
      if (!dim) return PLACEHOLDER;
      const values = data
        .map((d) => dimensionNumber(d, dim))
        .filter((n): n is number => n !== undefined);
      if (values.length === 0) return PLACEHOLDER;
      const sum = values.reduce((a, b) => a + b, 0);
      const n = def.kind === "sum" ? sum : sum / values.length;
      // Arrondi 1 décimale, format locale fr (séparateurs de milliers).
      const rounded = Math.round(n * 10) / 10;
      const text = rounded.toLocaleString("fr-FR");
      return def.unit ? `${text} ${def.unit}` : text;
    }
  }
}

/*───────────────────────────────────────────────────────────────*/
/* Graphes                                                       */
/*───────────────────────────────────────────────────────────────*/

// Palette catégorielle issue du THÈME du site (config.theme → --chart-1..5),
// cyclée pour les séries longues — jamais d'hex : les couleurs suivent le
// thème light/dark de chaque site.
const CATEGORICAL_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
] as const;

/** Couleur d'une valeur : map déclarée (jeton → var) sinon cycle catégoriel. */
export function colorFor(def: ChartDef, name: string, fallbackIndex: number): string {
  const token = def.colors?.[name];
  if (token && TOKEN_CSS_VARS[token]) return TOKEN_CSS_VARS[token];
  return CATEGORICAL_COLORS[fallbackIndex % CATEGORICAL_COLORS.length];
}

/** Décomptes {name, value} triés décroissants pour une dimension. */
export function itemsFor(
  def: ChartDef,
  data: ObservatoryItem[],
  dims: DimensionsConfig,
  labels?: LabelMaps,
): Array<{ name: string; value: number }> {
  const dim = def.dimension ? dims[def.dimension] : undefined;
  if (!dim) return [];
  const dimLabels = def.dimension ? labels?.[def.dimension] : undefined;
  const counts =
    dim.kind === "list"
      ? countBy(data.flatMap((d) => dimensionList(d, dim)), (v) => v)
      : countBy(data, (d) => dimensionValue(d, dim, dimLabels));
  return counts.sort((a, b) => b.value - a.value);
}

/** Titre d'un graphe : label (config) > labelKey (i18n) > label de la dimension. */
export function chartTitle(def: ChartDef, dims: DimensionsConfig, t: T): string {
  if (def.label) return t(def.label);
  if (def.labelKey) return t(def.labelKey);
  if (def.dimension) return dimensionLabel(t, dims, def.dimension);
  return "";
}

/** Appairage par layout : les `half` consécutifs vont par deux, les `full`
 *  occupent leur rangée. */
export function chartRows(charts: readonly ChartDef[]): ChartDef[][] {
  const rows: ChartDef[][] = [];
  for (const def of charts) {
    const last = rows[rows.length - 1];
    if (
      def.layout === "half" &&
      last?.length === 1 &&
      last[0].layout === "half"
    ) {
      last.push(def);
    } else {
      rows.push([def]);
    }
  }
  return rows;
}

/*───────────────────────────────────────────────────────────────*/
/* Table                                                         */
/*───────────────────────────────────────────────────────────────*/

export type SortDir = "asc" | "desc";
export type CellValue = string | number | boolean | undefined;

export interface Row {
  id: string;
  /** Index dans le dataset d'origine — aligne la ligne avec son entité SDK
   *  (rowAction "preview"). */
  index: number;
  /** Slug de l'entité (champs SDK) — rowAction "profil" → /profil/<slug>. */
  slug?: string;
  cells: Record<string, CellValue>;
  subtitles: Record<string, string | undefined>;
}

export function buildRow(
  e: ObservatoryItem,
  idx: number,
  columns: readonly TableColumnDef[],
  dims: DimensionsConfig,
  labels?: LabelMaps,
): Row {
  const cells: Record<string, CellValue> = {};
  const subtitles: Record<string, string | undefined> = {};
  for (const col of columns) {
    const def = dims[col.dimension];
    if (!def) continue;
    if (col.kind === "number") cells[col.dimension] = dimensionNumber(e, def);
    else if (col.kind === "boolBadge") cells[col.dimension] = dimensionBool(e, def);
    // Dimension `list` (allowlist) : la cellule montre la/les valeur(s) de
    // l'axe (typologie, surface…) — PAS `dimensionValue` qui renverrait le 1ᵉʳ
    // élément BRUT du tableau (ex. "TiersLieux").
    else if (def.kind === "list") cells[col.dimension] = dimensionList(e, def).join(", ");
    else cells[col.dimension] = dimensionValue(e, def, labels?.[col.dimension]);
    if (col.kind === "title" && col.subtitleDimension && dims[col.subtitleDimension]) {
      subtitles[col.dimension] = dimensionValue(e, dims[col.subtitleDimension], labels?.[col.subtitleDimension]);
    }
  }
  // Id de ligne : index d'origine (stable — rows reconstruits depuis data).
  const slug = typeof e.slug === "string" && e.slug !== "" ? e.slug : undefined;
  return { id: `row-${idx}`, index: idx, slug, cells, subtitles };
}

export function compare(a: Row, b: Row, col: TableColumnDef): number {
  const av = a.cells[col.dimension];
  const bv = b.cells[col.dimension];
  if (col.kind === "number") {
    const an = typeof av === "number" ? av : -Infinity;
    const bn = typeof bv === "number" ? bv : -Infinity;
    return an === bn ? 0 : an < bn ? -1 : 1;
  }
  if (col.kind === "boolBadge") {
    return av === bv ? 0 : av ? -1 : 1;
  }
  return String(av ?? "").localeCompare(String(bv ?? ""), "fr");
}

/*───────────────────────────────────────────────────────────────*/
/* Export CSV                                                    */
/*───────────────────────────────────────────────────────────────*/

function csvEscape(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

/**
 * CSV du résultat filtré/trié : en-têtes = libellés de colonnes, booléens
 * rendus avec les libellés fournis (oui/non i18n), séparateur « ; »
 * (convention Excel fr) — le BOM UTF-8 est ajouté au téléchargement.
 */
export function buildCsv(
  rows: readonly Row[],
  columns: readonly TableColumnDef[],
  headers: readonly string[],
  boolLabels: { yes: string; no: string },
): string {
  const lines: string[] = [headers.map(csvEscape).join(";")];
  for (const row of rows) {
    const cells = columns.map((col) => {
      const v = row.cells[col.dimension];
      if (col.kind === "boolBadge") return csvEscape(v ? boolLabels.yes : boolLabels.no);
      if (typeof v === "number") return String(v);
      return csvEscape(String(v ?? ""));
    });
    lines.push(cells.join(";"));
  }
  return lines.join("\n");
}

/**
 * Export CSV COMPLET (`export.fields`) : une colonne par champ déclaré, résolu
 * directement depuis l'item via le moteur de dimensions — indépendant des
 * colonnes du tableau. Permet d'exporter toutes les données de la fiche détail.
 * Les `items` sont passés DÉJÀ filtrés/triés (ordre du tableau).
 */
export function buildEntitiesCsv(
  items: readonly ObservatoryItem[],
  fields: readonly DimensionDef[],
  headers: readonly string[],
  boolLabels: { yes: string; no: string },
): string {
  const lines: string[] = [headers.map(csvEscape).join(";")];
  for (const item of items) {
    const cells = fields.map((def) => {
      if (isBoolKind(def.kind)) return csvEscape(dimensionBool(item, def) ? boolLabels.yes : boolLabels.no);
      if (def.kind === "number") {
        const n = dimensionNumber(item, def);
        return n === undefined ? "" : String(n);
      }
      if (def.kind === "list") return csvEscape(dimensionList(item, def).join(", "));
      return csvEscape(dimensionValue(item, def) ?? "");
    });
    lines.push(cells.join(";"));
  }
  return lines.join("\n");
}
