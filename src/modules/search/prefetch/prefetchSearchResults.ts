import type { QueryClient } from "@tanstack/react-query";
import { getBaseUrl } from "@/lib/constant/common";
import { initApi } from "@/lib/apiClient";
import { SEARCH_QUERY_KEYS, type SearchQueryKeyParams } from "../constants/queryKeys";
import { buildSearchPayload, type SearchBaseParamsInput } from "../lib/buildSearchPayload";

// Re-export du type pour backward compatibility
export type SearchPrefetchParams = SearchQueryKeyParams;

/**
 * Pré-charge les résultats de recherche pour le SSR
 *
 * @param queryClient - Instance de QueryClient pour le cache
 * @param params - Paramètres de recherche
 * @returns Les résultats de recherche ou null en cas d'erreur
 *
 * @example
 * await prefetchSearchResults(queryClient, {
 *   queryKeyPrefix: 'searchCostum',
 *   searchText: '',
 *   searchTags: {},
 *   searchType: { type: ['organizations'] },
 *   mapUsed: false,
 *   baseParams: { indexStepList: 10 },
 * });
 */
export async function prefetchSearchResults(
  queryClient: QueryClient,
  params: SearchPrefetchParams
) {
  // Utilise la query key centralisée
  const queryKey = SEARCH_QUERY_KEYS.RESULTS(params);

  try {
    return await queryClient.ensureQueryData({
      queryKey,
      queryFn: async () => {
        const { entity, api } = await initApi({
          baseURL: getBaseUrl()
        });

        const searchContext = entity || api;

        if (!(searchContext as unknown as Record<string, unknown>)?.searchCostum) {
          console.warn("searchCostum non disponible");
          return {
            pages: [{
              results: [],
              count: {},
              hasNext: false,
              pageNumber: 1
            }],
            pageParams: [undefined]
          };
        }

        const typeFlat = (params.searchType
          ? Object.values(params.searchType).flat()
          : []) as string[];
        const tags = Object.values(params.searchTags).flat() as string[];

        // Construire le payload via la MÊME source que le client
        // (`useSearchQuery` → `buildSearchPayload`). Indispensable : la
        // construction manuelle précédente ignorait les params de scope
        // (`sourceKey`, `costumSlug`, `contextId`, `contextType`, `costumEditMode`)
        // → le SSR fetchait un périmètre différent du client (ex. events scopés
        // par `sourceKey` uniquement côté client) → résultats SSR ≠ hydratés.
        const apiParam = buildSearchPayload(params.baseParams as SearchBaseParamsInput, {
          name: params.searchText,
          tags,
          type: typeFlat,
          mapUsed: params.mapUsed,
          graphUsed: params.graphUsed,
        }) as Record<string, unknown>;

        if (!apiParam.searchType) {
          return {
            pages: [{
              results: [],
              count: {},
              hasNext: false,
              pageNumber: 1
            }],
            pageParams: [undefined]
          };
        }

        // Propage le variant côté SSR aussi (sinon mismatch queryKey + endpoint).
        // ⚠ Appeler la méthode SUR searchContext (pas en variable destructurée)
        // sinon `this` est perdu → le SDK throw `_createPaginatorEngine of undefined`.
        const variant = params.variant;
        const target = searchContext as unknown as {
          searchCostum: (
            params: Record<string, unknown>,
            options?: { variant?: string }
          ) => Promise<unknown>;
        };
        const result = variant && variant !== "default"
          ? await target.searchCostum(apiParam, { variant })
          : await target.searchCostum(apiParam);

        return {
          pages: [result],
          pageParams: [undefined]
        };
      },
    });
  } catch (error) {
    console.error("Erreur préchargement recherche:", error);
    return null;
  }
}
