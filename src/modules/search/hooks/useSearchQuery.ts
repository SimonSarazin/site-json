import { useMemo, useEffect } from "react";
import { useCocolight } from "@/hooks/useCocolight";
import { useInfiniteQueryScrollNext } from "@/hooks/useInfiniteQueryScroll";
import { SearchEntity, SearchType } from "../schema";
import type { GlobalAutocompleteCostumData, PaginatorPage } from "@communecter/cocolight-api-client";
import { transformToEntityInstance } from "@/lib/entityTransform";
import { useQueryClient } from "@tanstack/react-query";
import cocolightApiClient from "@communecter/cocolight-api-client";

const { isReactive } = cocolightApiClient;

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
  const { entity, helper } = useCocolight();
  const queryClient = useQueryClient();

  const {
    data,
    error,
    lastItemRef,
    isFetchingNextPage,
    isLoading,
    isPending,
    refetch,
  } = useInfiniteQueryScrollNext<SearchEntity>({
    queryKey: [
      queryKeyPrefix,
      searchText,
      JSON.stringify(searchTags),
      JSON.stringify(searchType),
      mapUsed,
      JSON.stringify(baseParams),
    ],
    queryFn: async ({ pageParam } = { pageParam: undefined }) => {
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
      } catch (err) {
        console.error("Error fetching search results:", err);
        throw err;
      }
    },
    options: {
      enabled: !!entity,
      staleTime: 60 * 1000,
      initialPageParam: [],
    },
  });

  const queryKey = [
    queryKeyPrefix,
    searchText,
    JSON.stringify(searchTags),
    JSON.stringify(searchType),
    mapUsed,
    JSON.stringify(baseParams),
  ];

  // Transformer le cache une seule fois après l'hydratation SSR
  useEffect(() => {
    const currentData = queryClient.getQueryData<{ pages: PaginatorPage<SearchEntity>[]; pageParams: unknown[] }>(queryKey);

    if (currentData?.pages && currentData.pages.length > 0 && entity) {
      const firstItem = currentData.pages[0]?.results?.[0];
      if (firstItem && firstItem.serverData && !isReactive(firstItem.serverData)) {
        if (import.meta.env.DEV) {
          console.log("🔄 Transformation du cache de recherche après hydratation SSR");
        }
        // Transformer tout le cache en instances Proxy
        queryClient.setQueryData(queryKey, {
          ...currentData,
          pages: currentData.pages.map(page => ({
            ...page,
            results: page.results?.map(item =>
              transformToEntityInstance<SearchEntity>(item, helper, entity)
            ) ?? [],
          })),
        });
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Transformation des résultats
  const transformedResults = useMemo(() => {
    const results = data?.pages?.flatMap((p) => p?.results) ?? [];
    if (!entity || !results.length) return results || [];

    return results.map((item) => {
      // Si déjà transformé (Proxy), le retourner tel quel
      if (item.serverData && isReactive(item.serverData)) {
        return item;
      }
      // Sinon transformer en instance Proxy
      return transformToEntityInstance<SearchEntity>(item, helper, entity);
    });
  }, [data, entity, helper]);

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
