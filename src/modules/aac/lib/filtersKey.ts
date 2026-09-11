/**
 * Clé de cache CANONIQUE de l'état des filtres de l'annuaire — fonction PURE.
 *
 * Le troisième segment de `AAC_QUERY_KEYS.COMMUNS` doit dépendre du CONTENU des
 * filtres, jamais de la façon dont l'utilisateur y est arrivé : cocher A puis B
 * ou B puis A désigne la même liste, donc la même entrée de cache.
 *
 * D'où le refus de `JSON.stringify`, qui sérialise selon l'ordre d'insertion :
 * deux chemins de code produisant le même filtre donneraient deux entrées.
 * Ici les clés sont triées, les listes triées et dédoublonnées, le texte trimmé.
 */

/**
 * Les tris proposés, calqués sur le panneau legacy « Trier par ».
 *
 * `""` = l'ordre du serveur, qui est le défaut et n'est PAS un tri neutre : le
 * backend renvoie déjà les communs dans un ordre voulu. Ne jamais le remplacer
 * par un tri implicite.
 */
export type AacSortKey =
  | ""
  | "alpha"
  | "interest_desc"
  | "interest_asc"
  | "created_asc"
  | "created_desc"
  | "updated_asc"
  | "updated_desc";

export const AAC_SORT_KEYS: Exclude<AacSortKey, "">[] = [
  "alpha",
  "interest_desc",
  "interest_asc",
  "created_asc",
  "created_desc",
  "updated_asc",
  "updated_desc",
];

/** État des filtres de l'annuaire. */
export interface AacDirectoryFiltersState {
  /** Recherche par nom. Doit arriver DÉJÀ debouncée. */
  q: string;
  tags: string[];
  /** Question « Utilisable » — un radio, mais plusieurs valeurs cochables. */
  maturity: string[];
  /** Catégories d'usage (niveau 1 de « Filtrer par besoins »). */
  usage: string[];
  /** Sous-catégories d'usage (niveau 2). */
  usageSub: string[];
  sort: AacSortKey;
}

export const EMPTY_AAC_FILTERS: AacDirectoryFiltersState = {
  q: "",
  tags: [],
  maturity: [],
  usage: [],
  usageSub: [],
  sort: "",
};

/** Liste canonique : trim, retrait des vides, dédoublonnage, tri. */
function canonList(values: readonly string[] | undefined): string {
  if (!values) return "";
  const set = new Set(values.map((v) => v.trim()).filter(Boolean));
  return [...set].sort().join(",");
}

/** `true` si aucun filtre n'est actif — pilote l'état du bouton « Effacer ». */
export function hasActiveFilters(filters: AacDirectoryFiltersState): boolean {
  return (
    filters.q.trim() !== "" ||
    filters.tags.length > 0 ||
    filters.maturity.length > 0 ||
    filters.usage.length > 0 ||
    filters.usageSub.length > 0 ||
    filters.sort !== ""
  );
}

/**
 * Sérialise l'état des filtres en une chaîne stable.
 *
 * `pageSize` en fait partie : deux sections d'annuaire sur la même page avec des
 * tailles de page différentes ne doivent pas partager un cache dont les pages
 * n'ont pas le même découpage.
 *
 * Le TRI en fait partie aussi. Il est aujourd'hui appliqué en mémoire, mais il
 * deviendra un `orderBy` serveur : deux tris différents désignent alors deux
 * pages 1 différentes, donc deux entrées de cache. L'y mettre dès maintenant
 * évite d'avoir à invalider quoi que ce soit à la bascule.
 */
export function aacFiltersKey(
  filters: AacDirectoryFiltersState,
  opts: { pageSize: number }
): string {
  const parts: Record<string, string> = {
    maturity: canonList(filters.maturity),
    n: String(opts.pageSize),
    q: filters.q.trim().toLowerCase(),
    sort: filters.sort,
    tags: canonList(filters.tags),
    usage: canonList(filters.usage),
    usageSub: canonList(filters.usageSub),
  };
  return Object.keys(parts)
    .sort()
    .map((k) => `${k}=${parts[k]}`)
    .join("|");
}
