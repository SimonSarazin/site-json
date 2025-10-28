import { useMemo } from "react";
import { useCocolight } from "@/hooks/useCocolight";
import { useInfiniteQueryScrollNext } from "@/hooks/useInfiniteQueryScroll";
import { SearchResultPage, SearchType } from "../schema";
import type { GlobalAutocompleteCostumData } from "@communecter/cocolight-api-client";

export interface UseSearchQueryParams {
  queryKeyPrefix: string;
  searchText: string;
  searchTags: Record<string, string[]>;
  searchType: Record<string, string[]> | null;
  mapUsed: boolean;
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
  baseParams = {},
}: UseSearchQueryParams) {
  const { organization, helper } = useCocolight();

  const {
    data,
    error,
    lastItemRef,
    isFetchingNextPage,
    isLoading,
    isPending,
    refetch,
  } = useInfiniteQueryScrollNext({
    queryKey: [
      queryKeyPrefix,
      searchText,
      JSON.stringify(searchTags),
      JSON.stringify(searchType),
      mapUsed,
      JSON.stringify(baseParams),
    ],
    queryFn: async ({ pageParam } = { pageParam: undefined }) => {
      if (!organization) {
        throw new Error("API non initialisée");
      }

      const type = Array.isArray(searchType)
        ? searchType
        : searchType
          ? Object.values(searchType).flat()
          : [];
      const tags = Object.values(searchTags).flat() as string[];
      const page = pageParam as SearchResultPage | undefined;

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
      } = baseParams;

      const param: Partial<GlobalAutocompleteCostumData> = {
        name: searchText,
        fediverse,
        ...(mapUsed
          ? { mapUsed: true, indexMin: 0, indexStep: indexStepMap }
          : { indexMin: 0, indexStep: indexStepList }),
        ...(tags.length > 0 && {
          searchTags: tags,
          options: { tags: { verb: "$all" } },
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
        ...(notSourceKey ? { notSourceKey: true } : {}),
      };

      if (type && type.length > 0) param.searchType = type as GlobalAutocompleteCostumData["searchType"];
      if (!type && defaultTypes) param.searchType = defaultTypes;
      if (defaultTags && defaultTags.length > 0) {
        param.defaultTags = defaultTags;
      }

      if (!param.searchType) {
        return { results: [], count: {}, hasNext: false, pageNumber: 1 };
      }

      try {
        const result = await organization.searchCostum(param);
        if (
          page &&
          page?.pageNumber > 1 &&
          typeof page?.next !== "function" &&
          result.next
        ) {
          return result.next();
        }
        return result;
      } catch (err) {
        console.error("Error fetching search results:", err);
        throw err;
      }
    },
    options: {
      enabled: !!organization,
      staleTime: 60 * 1000,
      initialPageParam: [],
    },
  });

  // Transformation des résultats
  const transformedResults = useMemo(() => {
    const results = data?.pages?.flatMap((p) => p?.results) ?? [];
    if (!organization || !results.length) return results || [];
    return results.flatMap((d: any) => {
      if (d?.getEntityType) return d;
      return helper.fromEntityJSON(d, organization);
    });
  }, [data, organization, helper]);

  const hasCount =
    data?.pages?.[0]?.count && typeof data?.pages?.[0]?.count === "object";
  const totalCount =
    hasCount && data?.pages?.[0]?.count?.[("total")]
      ? data?.pages?.[0]?.count?.[("total")]
      : undefined;

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
