import type { QueryClient } from "@tanstack/react-query";
import { getBaseUrl } from "@/lib/constant/common";
import { initApi } from "@/lib/apiClient";
import { SEARCH_QUERY_KEYS, type SearchQueryKeyParams } from "../constants/queryKeys";

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
  const queryKey = SEARCH_QUERY_KEYS.results(params);

  try {
    return await queryClient.ensureQueryData({
      queryKey,
      queryFn: async () => {
        const { entity, api } = await initApi({
          baseURL: getBaseUrl()
        });

        const searchContext = entity || api;

        if (!searchContext?.searchCostum) {
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

        const type = params.searchType
          ? Object.values(params.searchType).flat()
          : [];
        const tags = Object.values(params.searchTags).flat();

        const {
          fediverse = false,
          indexStepList = 10,
          indexStepMap = 0,
          defaultTypes,
          defaultTags,
          defaultFilters,
          defaultFields,
          defaultSortBy,
          notSourceKey,
        } = params.baseParams as Record<string, unknown>;

        const apiParam: Record<string, unknown> = {
          name: params.searchText,
          fediverse,
          indexMin: 0,
          indexStep: params.mapUsed ? indexStepMap : indexStepList,
        };

        if (tags.length > 0) {
          apiParam.searchTags = tags;
          apiParam.options = { tags: { verb: "$all" } };
        }

        if (defaultFilters) apiParam.filters = defaultFilters;
        if (defaultFields) apiParam.fields = defaultFields;
        if (defaultSortBy) apiParam.sortBy = defaultSortBy;
        if (notSourceKey) apiParam.notSourceKey = true;

        if (type.length > 0) {
          apiParam.searchType = type;
        } else if (defaultTypes) {
          apiParam.searchType = defaultTypes;
        }

        if (defaultTags && Array.isArray(defaultTags) && defaultTags.length > 0) {
          apiParam.searchTags = defaultTags;
        }

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

        const result = await searchContext.searchCostum(apiParam);

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
