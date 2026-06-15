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

/*───────────────────────────────────────────────────────────────*/
/* Regroupement sur clé canonique (keyPaths) — libellé dérivé      */
/*───────────────────────────────────────────────────────────────*/
/** Map clé de groupe → libellé canonique, pour UNE dimension `keyPaths`. */
export type DimensionLabels = Map<string, string>;
/** Toutes les maps de libellés du dashboard (id de dimension → labels). */
export type LabelMaps = Record<string, DimensionLabels>;

/** Clé de regroupement d'un item : 1ʳᵉ valeur affichable de `keyPaths`. */
function groupKey(e: ObservatoryItem, def: DimensionDef): string | undefined {
  for (const p of def.keyPaths ?? []) {
    const s = asDisplayString(resolvePath(e, p));
    if (s !== undefined) return s;
  }
  return undefined;
}

/** Particules françaises restant en minuscule dans un nom propre composé
 *  ("Corse-du-Sud", "Val-d'Oise", "Seine-et-Marne"). */
const FR_PARTICLES = new Set([
  "de", "du", "des", "d", "la", "le", "les", "l", "sur", "sous", "lès", "en", "et", "au", "aux", "à",
]);

/** Title Case fr (repli quand AUCUNE variante n'a une casse propre) :
 *  "LOIRE-ATLANTIQUE" → "Loire-Atlantique", "CORSE-DU-SUD" → "Corse-du-Sud". */
function titleCaseFr(s: string): string {
  const titled = s
    .toLocaleLowerCase("fr")
    .replace(/(^|[\s\-'’])(\p{L})/gu, (_m, sep: string, ch: string) => sep + ch.toLocaleUpperCase("fr"));
  // Reminuscule les particules (sauf le 1ᵉʳ mot) : "Corse-Du-Sud" → "Corse-du-Sud".
  return titled.replace(/(?<=.[\s\-'’])(\p{Lu}\p{L}*)/gu, (w) =>
    FR_PARTICLES.has(w.toLocaleLowerCase("fr")) ? w.toLocaleLowerCase("fr") : w,
  );
}

/** Casse interne « sale » : une lettre suivie d'une MAJUSCULE (ex. "ARIèGE",
 *  "DROME") — par opposition à une casse propre ("Côtes-d'Armor", "Réunion"). */
const INTERNAL_UPPER = /\p{L}\p{Lu}/u;

/** « Richesse » d'une variante : préfère les accents (×5) puis la casse mixte —
 *  départage "Drôme" de "Drome", "Réunion" de "reunion". */
function labelRichness(s: string): number {
  const lower = (s.match(/\p{Ll}/gu) ?? []).length;
  const upper = (s.match(/\p{Lu}/gu) ?? []).length;
  const diacritics = (s.normalize("NFD").match(/\p{Diacritic}/gu) ?? []).length;
  const mixedBonus = lower > 0 && upper > 0 ? 2 : 0;
  return diacritics * 5 + mixedBonus + lower;
}

/**
 * Libellé canonique d'un groupe : on PRÉFÈRE une variante déjà proprement
 * casée (pas de majuscule interne, ex. "Côtes-d'Armor") — la plus « riche »
 * d'entre elles (accents). À défaut (le groupe n'a que des variantes sales,
 * ex. "ARIèGE"/"ARIEGE"), on prend la plus riche et on la Title-Case (repli).
 * Tie-break tri locale fr (stable, indépendant de l'ordre des données).
 */
export function pickCanonicalLabel(variants: Iterable<string>): string {
  const all = [...variants];
  if (all.length === 0) return "";
  const clean = all.filter((v) => !INTERNAL_UPPER.test(v));
  const pool = clean.length ? clean : all;
  let best = pool[0];
  let bestScore = labelRichness(best);
  for (const v of pool) {
    const score = labelRichness(v);
    if (score > bestScore || (score === bestScore && v.localeCompare(best, "fr") < 0)) {
      best = v;
      bestScore = score;
    }
  }
  // Variante déjà propre → telle quelle ; sinon Title Case fr de repli.
  return clean.length ? best : titleCaseFr(best);
}

/**
 * Construit, pour chaque dimension à `keyPaths`, la map clé→libellé canonique
 * en BALAYANT TOUT le dataset chargé : regroupe les variantes de libellé
 * (`paths`) par clé propre (`keyPaths`) puis élit la canonique. À calculer UNE
 * fois sur le dataset COMPLET (libellés stables, indépendants du filtrage).
 */
export function buildLabelMaps(data: ObservatoryItem[], dims: DimensionsConfig): LabelMaps {
  const maps: LabelMaps = {};
  for (const [id, def] of Object.entries(dims)) {
    if (!def.keyPaths?.length) continue;
    const variantsByKey = new Map<string, Set<string>>();
    for (const e of data) {
      const key = groupKey(e, def);
      if (key === undefined) continue;
      let label: string | undefined;
      for (const raw of sourceValues(e, def)) {
        const s = asDisplayString(raw);
        if (s !== undefined) {
          label = s;
          break;
        }
      }
      if (label === undefined) continue;
      const set = variantsByKey.get(key) ?? variantsByKey.set(key, new Set()).get(key)!;
      set.add(label);
    }
    const m: DimensionLabels = new Map();
    for (const [key, variants] of variantsByKey) m.set(key, pickCanonicalLabel(variants));
    maps[id] = m;
  }
  return maps;
}

/** kind "value" — première valeur affichable (chemin array-aware, y compris une
 *  réponse CoForm imbriquée), normalisée via `valueMap` si déclaré. Si la
 *  dimension a `keyPaths` ET qu'une map `labels` est fournie : la valeur est le
 *  libellé CANONIQUE du groupe (regroupement par clé propre) — sinon repli sur
 *  le chemin d'affichage. */
export function dimensionValue(
  e: ObservatoryItem,
  def: DimensionDef,
  labels?: DimensionLabels,
): string | undefined {
  if (def.keyPaths && labels) {
    const key = groupKey(e, def);
    if (key !== undefined) {
      const mapped = labels.get(key);
      if (mapped !== undefined) return mapped;
    }
    // pas de clé / clé absente de la map → repli sur le chemin ci-dessous
  }
  for (const raw of sourceValues(e, def)) {
    const s = asDisplayString(raw);
    if (s !== undefined) return normalizeValue(def, s);
  }
  return undefined;
}

/** kind "list" — première source produisant une liste non vide, DÉDUPLIQUÉE :
 *  une dimension list = l'ENSEMBLE des valeurs DISTINCTES de l'item sur cet axe.
 *  Plusieurs occurrences d'une même valeur (item à plusieurs réponses CoForm via
 *  un chemin array-aware, CSV répété, variantes fusionnées par `valueMap`) ne
 *  sur-comptent donc pas dans les graphes/cellules — un item pèse 1 par valeur
 *  distincte. `values` (allowlist) restreint et ORDONNE la sortie : décompose un
 *  champ fourre-tout (ex. `tags`) en axes distincts (typologie, portage,
 *  surface…) — ordre déclaré = ordre stable des parts/barres ; sinon l'ordre
 *  d'apparition est préservé (`Set`). */
export function dimensionList(e: ObservatoryItem, def: DimensionDef): string[] {
  for (const raw of sourceValues(e, def)) {
    const rawList = toStringList(raw);
    if (rawList.length > 0) {
      // valueMap AVANT dédup (les variantes fusionnent vers la canonique, donc
      // se dédupliquent), puis dédup TOUJOURS (Set ⇒ ordre d'apparition).
      const mapped = def.valueMap ? rawList.map((v) => normalizeValue(def, v)) : rawList;
      const list = [...new Set(mapped)];
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
    // racines des chemins d'affichage ET de la clé de regroupement (`keyPaths`).
    for (const path of [...(def.paths ?? []), ...(def.keyPaths ?? [])]) {
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
