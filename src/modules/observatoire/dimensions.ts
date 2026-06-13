// ------------------------------------------------------------
// dimensions.ts — moteur de dimensions du module observatoire
// ------------------------------------------------------------
// Le cœur générique : une dimension ({paths, kind}) décrit COMMENT lire une
// grandeur sur un item BRUT (serverData) ; le moteur la résout avec des
// coercions tolérantes (bool affirmatif, nombres en chaîne, dates SDK).
// Filtres, KPI, graphes et table consomment des dimensions — le code ne
// connaît AUCUN dataset : toutes les déclarations viennent de la config.
// ------------------------------------------------------------
import type { DimensionDef, DimensionsConfig, ObservatoryItem } from "./schema";

/*───────────────────────────────────────────────────────────────*/
/* Primitives de coercion (formats API hétérogènes)              */
/*───────────────────────────────────────────────────────────────*/

/** Coerce une valeur quelconque vers `true` si elle représente l'affirmatif. */
export function isTrue(value: unknown): boolean {
  if (value === true) return true;
  if (typeof value === "number") return value > 0;
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    return v === "true" || v === "1" || v === "oui" || v === "yes";
  }
  return false;
}

/** Extrait une valeur scalaire numérique si possible. */
export function toNumber(value: unknown): number | undefined {
  if (typeof value === "number" && !Number.isNaN(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (!Number.isNaN(n)) return n;
  }
  return undefined;
}

/** Valeur multi : string CSV (virgule/point-virgule) ou tableau → tableau plat. */
export function toStringList(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === "string" && v !== "");
  }
  if (typeof value === "string") {
    return value
      .split(/[,;]/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

/**
 * Représentation AFFICHABLE d'une valeur de champ : chaîne non vide, nombre,
 * Date (désérialisée par le SDK depuis l'EJSON Mongo → ISO court), 1ᵉʳ
 * élément affichable d'un tableau. Sinon `undefined` (champ « vide »).
 */
export function asDisplayString(value: unknown): string | undefined {
  if (typeof value === "string") return value.trim() !== "" ? value : undefined;
  if (typeof value === "number" && !Number.isNaN(value)) return String(value);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (Array.isArray(value)) {
    for (const v of value) {
      const s = asDisplayString(v);
      if (s !== undefined) return s;
    }
  }
  return undefined;
}

/*───────────────────────────────────────────────────────────────*/
/* Moteur                                                        */
/*───────────────────────────────────────────────────────────────*/

/**
 * Résolution de chemin GÉNÉRIQUE et ARRAY-AWARE : descend segment par segment
 * et, quand un segment tombe sur un TABLEAU (sans index numérique explicite),
 * mappe le reste du chemin sur CHAQUE élément puis aplatit (un niveau). Une
 * structure imbriquée arbitraire devient ainsi lisible par un simple `paths` —
 * y compris les réponses CoForm embarquées (`answers.<form>.serverData.answers
 * .<section>.<field>` : `answers.<form>` est un tableau d'entités Answer, le
 * reste du chemin est appliqué à chacune). Aucun accesseur métier.
 */
function resolveSegments(value: unknown, segments: string[]): unknown {
  if (segments.length === 0) return value;
  if (value == null) return undefined;
  const [head, ...rest] = segments;
  if (Array.isArray(value)) {
    // index numérique explicite → élément ; sinon → map + flatten.
    if (/^\d+$/.test(head)) return resolveSegments(value[Number(head)], rest);
    const collected = value
      .map((item) => resolveSegments(item, segments))
      .filter((v) => v != null);
    return collected.flat();
  }
  return resolveSegments((value as Record<string, unknown>)[head], rest);
}

function resolvePath(e: ObservatoryItem, path: string): unknown {
  // Chemin simple sans tableau intermédiaire : le reducer rapide du repo.
  // Sinon (tableau à traverser) : la résolution array-aware ci-dessus.
  return path.includes(".") ? resolveSegments(e, path.split(".")) : e[path];
}

/** Valeurs candidates d'une dimension : ses chemins (`paths`), résolus en
 *  mode array-aware. Source unique des résolveurs. */
function sourceValues(e: ObservatoryItem, def: DimensionDef): unknown[] {
  return (def.paths ?? []).map((p) => resolvePath(e, p));
}

/** Normalise une valeur via `def.valueMap` (variantes backend → canonique). */
function normalizeValue(def: DimensionDef, v: string): string {
  return def.valueMap?.[v] ?? v;
}

/** kind "value" — première valeur affichable (chemin array-aware, y compris une
 *  réponse CoForm imbriquée), normalisée via `valueMap` si déclaré. */
export function dimensionValue(e: ObservatoryItem, def: DimensionDef): string | undefined {
  for (const raw of sourceValues(e, def)) {
    const s = asDisplayString(raw);
    if (s !== undefined) return normalizeValue(def, s);
  }
  return undefined;
}

/** kind "list" — première source produisant une liste non vide. `values`
 *  (allowlist) restreint et ORDONNE la sortie : décompose un champ fourre-tout
 *  (ex. `tags`) en axes distincts (typologie, portage, surface…) — ordre
 *  déclaré = ordre stable des parts/barres. */
export function dimensionList(e: ObservatoryItem, def: DimensionDef): string[] {
  for (const raw of sourceValues(e, def)) {
    const rawList = toStringList(raw);
    if (rawList.length > 0) {
      // valueMap AVANT allowlist (les variantes fusionnent vers la canonique),
      // puis dédup (deux variantes du même item → une seule valeur).
      const list = def.valueMap ? [...new Set(rawList.map((v) => normalizeValue(def, v)))] : rawList;
      return def.values?.length ? def.values.filter((v) => list.includes(v)) : list;
    }
  }
  return [];
}

/** Kinds booléens : "anyTrue" (une source affirmative) et "contains" (une
 *  source-liste contient `value`). Centralisé pour le dispatch (filtres/KPI). */
export function isBoolKind(kind: DimensionDef["kind"]): boolean {
  return kind === "anyTrue" || kind === "contains";
}

/** kind "anyTrue" — au moins une source affirmative ; kind "contains" — au
 *  moins une source-liste contenant `def.value` (appartenance, ex. label). */
export function dimensionBool(e: ObservatoryItem, def: DimensionDef): boolean {
  if (def.kind === "contains") {
    const target = def.value;
    return target ? sourceValues(e, def).some((raw) => toStringList(raw).includes(target)) : false;
  }
  return sourceValues(e, def).some((raw) => isTrue(raw));
}

/** kind "number" — première valeur numérique (chemin array-aware). */
export function dimensionNumber(e: ObservatoryItem, def: DimensionDef): number | undefined {
  for (const raw of sourceValues(e, def)) {
    const n = toNumber(raw);
    if (n !== undefined) return n;
  }
  return undefined;
}

/** Libellé d'une dimension : label (config) > labelKey (i18n) > id. */
export function dimensionLabel(
  t: (key: string | Record<string, string>, fallback?: string) => string,
  dims: DimensionsConfig,
  id: string,
): string {
  const def = dims[id];
  if (!def) return id;
  if (def.label) return t(def.label);
  if (def.labelKey) return t(def.labelKey);
  return id;
}

/*───────────────────────────────────────────────────────────────*/
/* Projection API dérivée des dimensions                         */
/*───────────────────────────────────────────────────────────────*/

/** Champs requis par `_linkEntities` (SDK Cocolight) pour lier les entités. */
const SDK_BASE_FIELDS = ["collection", "_id", "id", "slug"] as const;

/**
 * Projection (`fields` de searchCostum) DÉRIVÉE des dimensions déclarées :
 * la racine de chaque chemin (+ champs SDK). On ne demande au backend que ce
 * que le dashboard consomme — pas de liste de champs à maintenir en config
 * (surchargeable malgré tout via `baseParams.defaultFields`). La racine suffit,
 * y compris pour un chemin array-aware imbriqué (ex. `answers.<form>…` →
 * `answers` : tout le sous-document embarqué est ramené).
 */
export function fieldsFromDimensions(dims: DimensionsConfig): string[] {
  const fields = new Set<string>(SDK_BASE_FIELDS);
  for (const def of Object.values(dims)) {
    for (const path of def.paths ?? []) {
      const root = path.split(".")[0];
      if (root) fields.add(root);
    }
  }
  return Array.from(fields);
}

/*───────────────────────────────────────────────────────────────*/
/* Filtres booléens                                              */
/*───────────────────────────────────────────────────────────────*/

/** Valeurs des filtres booléens (dimensions anyTrue) — sérialisées en URL. */
export const BOOL_FILTER_VALUES = {
  TRUE: "true",
  FALSE: "false",
} as const;

/*───────────────────────────────────────────────────────────────*/
/* Jetons de couleur → classes/variables (statiques pour Tailwind)*/
/*───────────────────────────────────────────────────────────────*/
/** Jeton → classes de pastille teintée (KPI, badges). */
export const TOKEN_TINT_CLASSES: Record<string, string> = {
  primary: "bg-primary/10 text-primary",
  accent: "bg-accent/15 text-accent",
  "chart-1": "bg-chart-1/15 text-chart-1",
  "chart-2": "bg-chart-2/15 text-chart-2",
  "chart-3": "bg-chart-3/15 text-chart-3",
  "chart-4": "bg-chart-4/15 text-chart-4",
  "chart-5": "bg-chart-5/15 text-chart-5",
  muted: "bg-muted text-muted-foreground",
};

/** Jeton → variable CSS (fills SVG recharts — suivent le thème au paint). */
export const TOKEN_CSS_VARS: Record<string, string> = {
  primary: "var(--primary)",
  accent: "var(--accent)",
  "chart-1": "var(--chart-1)",
  "chart-2": "var(--chart-2)",
  "chart-3": "var(--chart-3)",
  "chart-4": "var(--chart-4)",
  "chart-5": "var(--chart-5)",
  muted: "var(--muted-foreground)",
};
