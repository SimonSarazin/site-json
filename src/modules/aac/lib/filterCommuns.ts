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
 *  - OR à l'intérieur d'une facette, AND entre facettes.
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

function matchesUsageSub(card: AacCommunCard, selected: readonly string[]): boolean {
  if (selected.length === 0) return true;
  const owned = new Set(card.usage.subs);
  return selected.some((id) => owned.has(id));
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
      matchesUsageSub(card, filters.usageSub)
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
