/**
 * Filtrage et tri CLIENT des communs — fonctions PURES.
 *
 * Depuis la bascule sur `directoryproposal`, ces prédicats ne servent plus qu'au
 * **chemin balayage** du transport : celui qu'on emprunte quand au moins un
 * filtre n'est pas exprimable côté serveur (`usage`, `usageSub`, `maturity` —
 * cf. `aacQueryParams`).
 *
 * ⚠️ Ne PAS y voir un doublon du filtrage serveur : c'est `splitAacFilters` qui
 * garantit qu'un filtre déjà appliqué au serveur n'arrive pas ici. Les
 * prédicats `q` et `tags` restent donc nécessaires — ils s'appliquent quand le
 * chemin de la question correspondante n'est pas connu (formulaire pas encore
 * chargé), auquel cas le serveur ne peut rien filtrer.
 *
 * Ils disparaîtront le jour où `SearchNew::searchFilters` saura composer un
 * `$and` générique : tout partira alors au serveur.
 *
 * Sémantique, calquée sur celle des facettes du module search :
 *  - `q` : sous-chaîne du titre, insensible à la casse ET aux accents ;
 *  - OR à l'intérieur d'une facette, AND entre facettes ;
 *  - `usageSub` : clés QUALIFIÉES `<catégorie>/<sous-catégorie>` (cf.
 *    `usageSubKey`), lues sous leur catégorie — une clé nue reste tolérée et se
 *    lit sous les catégories retenues.
 */
import type { AacCommunCard } from "./parseAacAnswer";
import type { AacDirectoryFiltersState, AacSortKey } from "./filtersKey";

/**
 * Repli et normalisation pour comparaison : minuscules, accents retirés.
 * « Écologie » doit matcher « ecologie », et réciproquement.
 */
export function foldForSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // marques diacritiques combinantes
    .toLowerCase()
    .trim();
}

function matchesQuery(card: AacCommunCard, q: string): boolean {
  const needle = foldForSearch(q);
  if (!needle) return true;
  return foldForSearch(card.title).includes(needle);
}

function matchesAnyOf(values: readonly string[], selected: readonly string[]): boolean {
  if (selected.length === 0) return true;
  const folded = new Set(values.map(foldForSearch));
  return selected.some((s) => folded.has(foldForSearch(s)));
}

/**
 * Les identifiants d'usage sont comparés TELS QUELS, sans repliement.
 *
 * Ce sont des slugs générés (`1_communication-externe`), pas du texte saisi :
 * les replier n'apporterait rien et masquerait une éventuelle divergence entre
 * l'arbre du filtre et les réponses.
 */
function matchesUsage(card: AacCommunCard, selected: readonly string[]): boolean {
  if (selected.length === 0) return true;
  const owned = new Set([...card.usage.categories, ...Object.keys(card.usage.bySub)]);
  return selected.some((id) => owned.has(id));
}

/**
 * Séparateur de la clé QUALIFIÉE d'une sous-catégorie : `<catégorie>/<sous-catégorie>`.
 *
 * Un identifiant de sous-catégorie (`2_site-vitrine`) n'est unique que DANS sa
 * catégorie (cf. `aacUsage.ts`) : deux catégories peuvent porter le même. Seule
 * la paire désigne une pastille. Le `/` ne peut pas apparaître dans un
 * identifiant (`<index>_<slug>`, slug en `[a-z0-9-]`) — c'est déjà la forme
 * qu'emploie `aacUsage.test.ts` pour vérifier l'unicité des enfants.
 */
export const USAGE_SUB_KEY_SEPARATOR = "/";

export function usageSubKey(categoryId: string, subId: string): string {
  return `${categoryId}${USAGE_SUB_KEY_SEPARATOR}${subId}`;
}

/** Une clé NUE (`2_site-vitrine`, l'état historique) rend `categoryId: null`. */
export function parseUsageSubKey(key: string): { categoryId: string | null; subId: string } {
  const at = key.indexOf(USAGE_SUB_KEY_SEPARATOR);
  if (at < 0) return { categoryId: null, subId: key };
  return { categoryId: key.slice(0, at), subId: key.slice(at + 1) };
}

/**
 * Une sous-catégorie QUALIFIÉE ne se lit que sous SA catégorie, dans
 * `usage.bySub` — jamais dans `usage.subs`, l'aplat qui confond les homonymes.
 *
 * Une clé NUE se lit sous les catégories RETENUES (`selectedCategories`), sous
 * toutes si aucune ne l'est : l'union qui en résulte est la limite de la forme
 * nue, pas un choix — d'où les clés qualifiées.
 */
function matchesUsageSub(
  card: AacCommunCard,
  selectedSubs: readonly string[],
  selectedCategories: readonly string[]
): boolean {
  if (selectedSubs.length === 0) return true;
  const bySub = card.usage.bySub;
  const scope = selectedCategories.length > 0 ? selectedCategories : Object.keys(bySub);
  return selectedSubs.some((key) => {
    const { categoryId, subId } = parseUsageSubKey(key);
    const categories = categoryId ? [categoryId] : scope;
    return categories.some((c) => (bySub[c] ?? []).includes(subId));
  });
}

export function filterCommuns(
  cards: readonly AacCommunCard[],
  filters: AacDirectoryFiltersState
): AacCommunCard[] {
  const matching = cards.filter(
    (card) =>
      matchesQuery(card, filters.q) &&
      matchesAnyOf(card.tags, filters.tags) &&
      matchesAnyOf(card.maturity ? [card.maturity] : [], filters.maturity) &&
      matchesUsage(card, filters.usage) &&
      matchesUsageSub(card, filters.usageSub, filters.usage)
  );

  return sortCommuns(matching, filters.sort);
}

/**
 * Tri stable.
 *
 * `""` rend la liste INCHANGÉE : l'ordre du serveur est un choix, pas un
 * accident, et le remplacer par un tri implicite le perdrait silencieusement.
 */
export function sortCommuns(
  cards: readonly AacCommunCard[],
  sort: AacSortKey
): AacCommunCard[] {
  if (!sort) return [...cards];

  const compare: Record<Exclude<AacSortKey, "">, (a: AacCommunCard, b: AacCommunCard) => number> =
    {
      alpha: (a, b) => a.title.localeCompare(b.title, "fr", { sensitivity: "base" }),
      interest_desc: (a, b) => b.interestCount - a.interestCount,
      interest_asc: (a, b) => a.interestCount - b.interestCount,
      created_asc: (a, b) => a.createdAt - b.createdAt,
      created_desc: (a, b) => b.createdAt - a.createdAt,
      updated_asc: (a, b) => a.updatedAt - b.updatedAt,
      updated_desc: (a, b) => b.updatedAt - a.updatedAt,
    };

  return [...cards].sort(compare[sort]);
}
