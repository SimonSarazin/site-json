import { useMemo } from "react";
import { useCocolight } from "@/hooks/useCocolight";
import { useInfiniteQueryScrollNextWithTransform } from "@/hooks/useInfiniteQueryScroll";
import { SearchType } from "../schema";
import type { SearchEntity } from "@communecter/cocolight-api-client";
import type { GlobalAutocompleteCostumData, PaginatorPage } from "@communecter/cocolight-api-client";
import { SEARCH_QUERY_KEYS } from "../constants/queryKeys";

export interface UseSearchQueryParams {
  queryKeyPrefix: string;
  searchText: string;
  searchTags: Record<string, string[]>;
  searchType: Record<string, string[]> | null;
  mapUsed: boolean;
  graphUsed?: boolean;
  tagsVerb?: "$all" | "$in";
  baseParams?: {
    fediverse?: boolean;
    indexStepList?: number;
    indexStepMap?: number;
    defaultTypes?: SearchType[];
    defaultTags?: string[];
    defaultFilters?: Record<string, unknown>;
    defaultFields?: string[];
    defaultSortBy?: Record<string, 1 | -1>;
    notSourceKey?: boolean;
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
  tagsVerb = "$all",
  baseParams = {},
}: UseSearchQueryParams) {
  const { entity, helper } = useCocolight();

  // Query key centralisée (single source of truth)
  const queryKey = SEARCH_QUERY_KEYS.results({
    queryKeyPrefix,
    searchText,
    searchTags,
    searchType,
    mapUsed,
    graphUsed,
    baseParams,
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
        locality,
      } = baseParams;

      const extra = baseParams as Record<string, unknown>;

      const graphIndexStep = 0;

      const param: Partial<GlobalAutocompleteCostumData> = {
        name: searchText,
        fediverse,
        ...(graphUsed
          ? { indexMin: 0, indexStep: graphIndexStep }
          : mapUsed
            ? { mapUsed: true, indexMin: 0, indexStep: indexStepMap }
            : { indexMin: 0, indexStep: indexStepList }),
        ...(tags.length > 0 && {
          searchTags: tags,
          options: { tags: { verb: tagsVerb } },
        }),
        ...(defaultFilters && Object.keys(defaultFilters).length > 0 && {
          filters: defaultFilters,
        }),
        ...(defaultFields && defaultFields.length > 0 && {
          fields: defaultFields,
        }),
        ...(defaultSortBy && Object.keys(defaultSortBy).length > 0 && {
          sortBy: defaultSortBy,
        }),
        ...(locality && Object.keys(locality).length > 0 && { locality: locality as GlobalAutocompleteCostumData["locality"] }),
        ...(notSourceKey ? { notSourceKey: true } : {}),
        ...(extra.contextId ? { contextId: extra.contextId as string } : {}),
        ...(extra.contextType ? { contextType: extra.contextType as GlobalAutocompleteCostumData["contextType"] } : {}),
        ...(extra.costumSlug ? { costumSlug: extra.costumSlug as string } : {}),
        ...(extra.costumEditMode !== undefined ? { costumEditMode: extra.costumEditMode as boolean } : {}),
        ...(extra.sourceKey ? { sourceKey: extra.sourceKey as string[] } : {}),
      } as Partial<GlobalAutocompleteCostumData>;
      console.log("Search params:", param);

      if (type && type.length > 0) param.searchType = type as unknown as GlobalAutocompleteCostumData["searchType"];
      if (!type && defaultTypes) param.searchType = defaultTypes as unknown as GlobalAutocompleteCostumData["searchType"];
      if (defaultTags && defaultTags.length > 0) {
        param.searchTags = defaultTags;
      }

      if (!param.searchType) {
        return { results: [], count: { total: 0 }, hasNext: false, hasPrev: false, pageNumber: 1, pageIndex: 0 };
      }

      try {
        const result = await entity.searchCostum(param);
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
