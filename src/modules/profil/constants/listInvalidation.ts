import type { QueryKey } from "@tanstack/react-query";
import { SEARCH_QUERY_KEYS, SEARCH_STAT_COUNT_PREFIX } from "@/modules/search/constants";
import { AGENDA_QUERY_KEYS } from "@/modules/agenda/constants/queryKeys";

/**
 * Listes à rafraîchir après CRÉATION ou SUPPRESSION d'une entité — une entité n'apparaît pas que
 * sur son profil : elle peuple aussi les sections de recherche (searchPro/searchProStatic/cardCount)
 * et les chiffres des tuiles de stat, qui ont leurs propres clés. Sans cette invalidation, la liste
 * (ex. `/projets`) reste périmée et continue d'afficher une fiche supprimée.
 *
 * `RESULTS_PREFIX` = partial-match → couvre toutes les variations de filtres ; l'invalidation au
 * niveau `queryClient` persiste malgré la navigation qui suit la mutation.
 */
export const SEARCH_LISTS_INVALIDATION: QueryKey[] = [
  SEARCH_QUERY_KEYS.RESULTS_PREFIX("searchCostumStatic"),
  SEARCH_QUERY_KEYS.RESULTS_PREFIX("searchCostumStaticMapAll"),
  SEARCH_QUERY_KEYS.RESULTS_PREFIX("searchCostum"),
  SEARCH_QUERY_KEYS.RESULTS_PREFIX("searchCostumMapAll"),
  SEARCH_QUERY_KEYS.RESULTS_PREFIX("cardCountCT"),
  SEARCH_QUERY_KEYS.RESULTS_PREFIX(SEARCH_STAT_COUNT_PREFIX),
];

/** Idem pour un ÉVÉNEMENT, qui s'affiche EN PLUS dans le module agenda (calendrier + liste). */
export const EVENT_LISTS_INVALIDATION: QueryKey[] = [
  ...SEARCH_LISTS_INVALIDATION,
  AGENDA_QUERY_KEYS.CALENDAR_PREFIX(),
  AGENDA_QUERY_KEYS.LIST_PREFIX(),
];
