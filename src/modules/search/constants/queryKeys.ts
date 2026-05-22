/**
 * Query keys centralisés pour le module Search
 * Single source of truth pour les query keys de recherche
 */

export interface SearchQueryKeyParams {
  queryKeyPrefix: string;
  searchText: string;
  searchTags: Record<string, string[]>;
  searchType: Record<string, string[]> | null;
  mapUsed: boolean;
  graphUsed?: boolean;
  baseParams: Record<string, unknown>;
  /**
   * Variant SDK (`default` ou `navigator-tl`). Inclus dans la queryKey pour
   * éviter qu'un cache de variant `default` ne contamine un consommateur
   * `navigator-tl` (les résultats ont des champs différents).
   */
  variant?: string;
}

export const SEARCH_QUERY_KEYS = {
  /**
   * Génère une query key pour les résultats de recherche
   * Utilisé par useSearchQuery et prefetchSearchResults
   */
  results: (params: SearchQueryKeyParams) => [
    params.queryKeyPrefix,
    params.searchText,
    JSON.stringify(params.searchTags),
    JSON.stringify(params.searchType),
    params.mapUsed,
    params.graphUsed ?? false,
    JSON.stringify(params.baseParams),
    params.variant ?? "default",
  ] as const,
} as const;

export type SearchQueryKeyType = typeof SEARCH_QUERY_KEYS;
