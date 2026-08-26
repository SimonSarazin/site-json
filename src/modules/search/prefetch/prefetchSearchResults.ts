import type { QueryClient } from "@tanstack/react-query";
import { getBaseUrl } from "@/lib/constant/common";
import { initApi } from "@/lib/apiClient";
import { SEARCH_QUERY_KEYS, type SearchQueryKeyParams } from "../constants/queryKeys";
import { buildSearchPayload, type SearchBaseParamsInput } from "../lib/buildSearchPayload";
import { expandCostumSubType, type CostumFormSubTypeLike } from "../lib/costumSubType";

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
  params: SearchPrefetchParams,
  opts?: { costumForms?: Record<string, CostumFormSubTypeLike> },
) {
  // `costumSubType` doit être expansé ICI aussi ($or identity/annotation) — le client le fait dans
  // `useSearchQuery` et calcule sa queryKey sur les baseParams EXPANSÉS : sans le miroir SSR, la clé
  // préchargée ne matcherait pas (refetch à l'hydratation) et surtout la page servie mélangerait les
  // sous-types (costumSubType est inconnu de buildSearchPayload → aucun filtre). L'expansion exige le
  // slug du porteur → initApi est hissé AVANT le calcul de la clé (en SSR chaque requête a son
  // queryClient : queryFn s'exécutait de toute façon, le hissage est neutre).
  const { entity, api } = await initApi({ baseURL: getBaseUrl() });
  const baseParamsExpanses = expandCostumSubType(
    params.baseParams as { costumSubType?: string; defaultFilters?: Record<string, unknown> } | undefined,
    opts?.costumForms,
    (entity as { slug?: string } | null)?.slug,
  ) ?? {};
  const paramsEffectifs = { ...params, baseParams: baseParamsExpanses };

  // Utilise la query key centralisée
  const queryKey = SEARCH_QUERY_KEYS.RESULTS(paramsEffectifs);

  try {
    return await queryClient.ensureQueryData({
      queryKey,
      queryFn: async () => {

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
        const apiParam = buildSearchPayload(baseParamsExpanses as SearchBaseParamsInput, {
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
