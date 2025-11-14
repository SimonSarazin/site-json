import { SearchResultPage } from "@/modules/search/schema";
import { useCocolight } from "./useCocolight";
import { useInfiniteQueryScrollNext } from "./useInfiniteQueryScroll";
import { CoformAnswersSearchData, User } from "@communecter/cocolight-api-client";
import { useMemo } from "react";
import getMultipleValuesByPaths from "@/helpers/getMultipleValuesByPaths";

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
    };
    extractionConfig?: {
        dataPath: Record<string, string | undefined>;
        prefix?: string;
        includeUserInfo?: boolean;
    };
}

export function useFetchAnswer({
    queryKeyPrefix,
    coformId,
    view,
    baseParams = {},
    extractionConfig
}: UseFetchAnswerParams) {
    const { entity, helper } = useCocolight();

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
            if (!entity) {
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
                const result = await entity.coformAnswersSearch(param);
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
    // Transformation et extraction en une seule boucle pour optimiser les performances
    const transformedResults = useMemo(() => {
        const results = data?.pages?.flatMap((p) => p?.results) ?? [];
        if (!entity || !results.length) return results || [];

        return results.flatMap((d: any) => {
            // 1. Transformation : JSON -> Entity
            const item = d?.getEntityType ? d : helper.fromEntityJSON(d, entity);

            // 2. Extraction optionnelle (si extractionConfig fourni)
            if (extractionConfig) {
                const extractedFields = getMultipleValuesByPaths(
                    item.serverData,
                    extractionConfig.dataPath,
                    extractionConfig.prefix || "answers"
                );

                let userInfo = undefined;
                if (extractionConfig.includeUserInfo) {
                    const user = item.serverData.user as User | undefined;
                    const userName = user?.serverData?.name || "";
                    userInfo = {
                        name: userName,
                        initial: userName.charAt(0) || "",
                        exists: !!user
                    };
                }

                return {
                    answer: item,
                    data: extractedFields,
                    ...(userInfo && { user: userInfo })
                };
            }

            // Retourne l'entité simple si pas d'extraction
            return item;
        });
    }, [data, entity, helper, extractionConfig]);

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