import { useMemo } from "react";
import { useCocolight } from "@/hooks/useCocolight";
import { useInfiniteQueryScrollNextWithTransform } from "@/hooks/useInfiniteQueryScroll";
import { SearchType } from "../schema";
import type { SearchEntity } from "@communecter/cocolight-api-client";
import type { PaginatorPage } from "@communecter/cocolight-api-client";
import { SEARCH_QUERY_KEYS } from "../constants/queryKeys";
import { buildSearchPayload } from "../lib/buildSearchPayload";

export interface UseSearchQueryParams {
  queryKeyPrefix: string;
  searchText: string;
  searchTags: Record<string, string[]>;
  searchType: Record<string, string[]> | null;
  mapUsed: boolean;
  graphUsed?: boolean;
  /**
   * Variant SDK pour `searchCostum`. Cf. `SearchVariantSchema`. Si absent ou
   * `"default"`, on appelle `searchCostum(payload)` sans le 2e argument
   * (comportement préservé). Sinon on passe `{ variant }` → endpoint alternatif.
   */
  variant?: "default" | "navigator-tl";
  baseParams?: {
    fediverse?: boolean;
    indexStepList?: number;
    indexStepMap?: number;
    defaultTypes?: SearchType[];
    defaultTags?: string[];
    defaultFilters?: Record<string, unknown>;
    defaultFields?: string[];
    defaultSortBy?: Record<string, 1 | -1>;
    // Cf. `SearchBySchema` — "ALL" | CSV | string[]. Propagé au payload SDK
    // dès qu'il est défini ; sinon le backend applique son comportement par défaut.
    searchBy?: string | string[];
    // Accepte `boolean` (ne pas sourcer) ou `number` (limite custom) — cf.
    // schema search.ts (config historique avec valeur numérique).
    notSourceKey?: boolean | number;
    locality?: Record<string, {
      name?: string;
      active?: boolean;
      id: string;
      countryCode?: string;
      level?: string | number;
      type: string;
      key?: string;
    }>;
  };
}

/**
 * Hook personnalisé pour gérer la requête de recherche
 * Factorise la logique de fetch entre SearchPro et SearchProStatic
 */
export function useSearchQuery({
  queryKeyPrefix,
  searchText,
  searchTags,
  searchType,
  mapUsed,
  graphUsed = false,
  variant,
  baseParams = {},
}: UseSearchQueryParams) {
  const { entity, helper } = useCocolight();

  // Query key centralisée (single source of truth)
  const queryKey = SEARCH_QUERY_KEYS.RESULTS({
    queryKeyPrefix,
    searchText,
    searchTags,
    searchType,
    mapUsed,
    graphUsed,
    baseParams,
    variant,
  });

  const {
    data,
    error,
    lastItemRef,
    isFetchingNextPage,
    isLoading,
    isPending,
    refetch,
    totalCount,
    hasCount,
  } = useInfiniteQueryScrollNextWithTransform<SearchEntity>({
    queryKey,
    queryFn: async ({ pageParam }) => {
      if (!entity) {
        throw new Error("API non initialisée - entity manquante");
      }

      const type = Array.isArray(searchType)
        ? searchType
        : searchType
          ? Object.values(searchType).flat()
          : [];
      const tags = Object.values(searchTags).flat() as string[];
      const page = pageParam as PaginatorPage<SearchEntity> | undefined;

      const param = buildSearchPayload(baseParams, {
        name: searchText,
        tags,
        type,
        mapUsed,
        graphUsed,
      });

      if (!param.searchType) {
        return { results: [], count: { total: 0 }, hasNext: false, hasPrev: false, pageNumber: 1, pageIndex: 0 };
      }

      try {
        // Passe `{ variant }` au SDK uniquement quand non-default — préserve
        // le call site existant pour les sites qui n'utilisent pas le variant.
        const result = variant && variant !== "default"
          ? await entity.searchCostum(param, { variant })
          : await entity.searchCostum(param);
        if (
          page &&
          page?.pageNumber > 1 &&
          typeof page?.next !== "function" &&
          result.next
        ) {
          return result.next();
        }
        return result;
      } catch (error) {
        console.error("Error fetching search results:", error);
        if (error && typeof error === "object") {
        console.error("Error details:", {
          message: (error as Record<string, unknown>).message,
          validationErrors: (error as Record<string, unknown>).validationErrors,
          details: (error as Record<string, unknown>).details,
          response: (error as Record<string, unknown>).response,
          data: (error as Record<string, unknown>).data,
        });
      }
        throw error;
      }
    },
    options: {
      enabled: !!entity,
      staleTime: 60 * 1000,
      initialPageParam: undefined,
    },
    // Transformation SSR automatique via le hook
    transform: entity ? { entity, helper } : undefined,
  });

  // Les résultats sont déjà transformés par le hook
  const transformedResults = useMemo(() => {
    return data?.pages?.flatMap((p) => p?.results) ?? [];
  }, [data?.pages]);

  return {
    data,
    error,
    lastItemRef,
    isFetchingNextPage,
    isLoading,
    isPending,
    refetch,
    transformedResults,
    totalCount,
    hasCount,
  };
}
