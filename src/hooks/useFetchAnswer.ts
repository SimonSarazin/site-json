import { SearchResultPage } from "@/modules/search/schema";
import { useCocolight } from "./useCocolight";
import { useInfiniteQueryScrollNext } from "./useInfiniteQueryScroll";
import { CoformAnswersSearchData } from "@communecter/cocolight-api-client";
import { useMemo } from "react";

export interface UseFetchAnswerParams {
    queryKeyPrefix: string;
    coformId: string;
    view: 'answers' | 'map' | 'split';
    baseParams?: {
        fediverse?: boolean;
        indexStepList?: number;
        indexStepMap?: number;
        defaultFilters?: Record<string, any>;
        defaultFields?: string[];
        defaultSortBy?: Record<string, 1 | -1>;
        notSourceKey?: boolean;
    }
}

export function useFetchAnswer({
    queryKeyPrefix,
    coformId,
    view,
    baseParams = {}
}: UseFetchAnswerParams) {
    const { organization, entity, helper } = useCocolight();
    const searchContext = organization || entity;
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
            coformId,
            view,
            JSON.stringify(baseParams),
        ],
        queryFn: async ({ pageParam } = { pageParam: undefined }) => {
            if (!searchContext) {
                throw new Error("API non initialisée - ni organization ni entity disponible");
            }

            const page = pageParam as SearchResultPage | undefined;

            const {
                fediverse = false,
                indexStepList = 30,
                indexStepMap = 0,
                notSourceKey,
                defaultFilters,
                defaultFields,
                defaultSortBy,
            } = baseParams;

            const param: Partial<CoformAnswersSearchData> = {
                fediverse,
                ...(
                    view != "answers" ? {
                        indexMin: 0,
                        indexStep: indexStepMap,
                    } : {
                        indexMin: 0,
                        indexStep: indexStepList,
                    }
                ),
                count: true,
                searchType: ["answers"],
                countType: ["answers"],
                filters: defaultFilters,
                fields: defaultFields,
                ...(defaultSortBy && Object.keys(defaultSortBy).length > 0 && {
                    sortBy: defaultSortBy,
                }),
                ...(notSourceKey ? { notSourceKey: true } : {}),
            }

            if (!param.searchType) {
                return { results: [], count: {}, hasNext: false, pageNumber: 1 };
            }


            try {
                const result = await searchContext.coformAnswersSearch(param);
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
            enabled: !!searchContext,
            staleTime: 60 * 1000,
            initialPageParam: [],
        },
    });
    const transformedResults = useMemo(() => {
        const results = data?.pages?.flatMap((p) => p?.results) ?? [];
        if (!searchContext || !results.length) return results || [];
        return results.flatMap((d: any) => {
            if (d?.getEntityType) return d;
            return helper.fromEntityJSON(d, organization || searchContext);
        });
    }, [data, organization, searchContext, helper]);
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
        transformedResults,
        isFetchingNextPage,
        isLoading,
        isPending,
        refetch,
        totalCount
    };
}