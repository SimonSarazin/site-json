/**
 * Query keys du module search — centralisées (single source of truth).
 *
 * Producteurs : `useSearchQuery`, `prefetchSearchResults`
 * Consommateurs invalidants (tous par `RESULTS_PREFIX`) : `SearchProStatic` et
 *   `PreviewCoformAnswer` (écriture d'une answer CoForm), `addStandard`
 *   (création/édition d'entité), `PreviewPoiAmenities` (suppression de POI).
 *   Sinon refetch via `refetch()` ou changement des params (qui change la
 *   queryKey naturellement).
 *
 * `variant` est inclus dans la clé pour isoler les caches de variants SDK
 * (`default` vs `navigator-tl`) — sans cette dimension, un consommateur
 * `navigator-tl` pourrait se voir servir un cache `default` aux champs
 * différents.
 *
 * Le `queryKeyPrefix` est passé par le call-site car le module search est
 * utilisé par plusieurs sections (annuaire, carte, graph, etc.) avec des
 * préfixes différents — il ne peut pas être figé comme pour `ampli`.
 */
/**
 * Préfixes des deux queries d'une section `searchProStatic` (liste / carte).
 * Partagés entre les queries elles-mêmes (`SearchProStatic`) et les
 * invalidations post-écriture d'answer (`SearchProStatic`,
 * `PreviewCoformAnswer`) — un littéral divergent invaliderait dans le vide.
 *
 * ⚠️ Les MÊMES littéraux vivent encore ailleurs (prefetch SSR `buildRoutes`,
 * `addStandard`, `PreviewPoiAmenities`) : les rallier ici est une dette ouverte,
 * hors périmètre de ce lot.
 */
export const SEARCH_STATIC_LIST_PREFIX = "searchCostumStatic";
export const SEARCH_STATIC_MAP_PREFIX = "searchCostumStaticMapAll";

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
   * Résultats de recherche paginés.
   *
   * Producteurs : `useSearchQuery`, `prefetchSearchResults`
   * Consommateurs invalidants : `invalidateSearchStaticResults` (création /
   *   édition d'une answer CoForm — ex. créneau), `addStandard`,
   *   `PreviewPoiAmenities` — tous par `RESULTS_PREFIX`.
   */
  RESULTS: (params: SearchQueryKeyParams) =>
    [
      params.queryKeyPrefix,
      params.searchText,
      JSON.stringify(params.searchTags),
      JSON.stringify(params.searchType),
      params.mapUsed,
      params.graphUsed ?? false,
      JSON.stringify(params.baseParams),
      params.variant ?? "default",
    ] as const,
  /**
   * Préfixe minimal pour invalidation cross-recherche (toutes les variations
   * de filtres pour un préfixe donné).
   */
  RESULTS_PREFIX: (queryKeyPrefix: string) => [queryKeyPrefix] as const,
  /**
   * Réservations CoForm d'une ressource (section réservations du preview
   * `poi-amenities`).
   *
   * Producteur : `useReservationsQuery`. Données PUBLIQUES (endpoint
   * answerslist public → pas de dimension userId). Invalidation : aucune —
   * staleTime + refetch au remontage suffisent.
   */
  RESERVATIONS: (formId: string, resourceId: string) =>
    ["search-reservations", formId, resourceId] as const,
} as const;

export type SearchQueryKeyType = ReturnType<
  (typeof SEARCH_QUERY_KEYS)[keyof typeof SEARCH_QUERY_KEYS]
>;
