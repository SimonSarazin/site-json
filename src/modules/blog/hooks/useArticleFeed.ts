import { useSearchQuery } from "@/modules/search/hooks/useSearchQuery";

/** Fil d'articles d'un costum (POI type=article, scope source.key) — paginé, trié par date décroissante.
 *  Réutilise useSearchQuery (searchCostum) : searchType poi + defaultFilters type=article + scope costum. */
export interface UseArticleFeedParams {
  costumSlug: string;
  pageSize?: number;
  filters?: Record<string, unknown>;
}

export function useArticleFeed({ costumSlug, pageSize = 12, filters }: UseArticleFeedParams) {
  return useSearchQuery({
    queryKeyPrefix: `blog:${costumSlug}`,
    searchText: "",
    searchTags: {},
    // ⚠ searchType explicite obligatoire (buildSearchPayload n'applique defaultTypes que si type===undefined).
    searchType: { type: ["poi"] },
    mapUsed: false,
    baseParams: {
      indexStepList: pageSize,
      defaultFilters: { type: "article", ...(filters ?? {}) },
      defaultSortBy: { created: -1 },
      // scope costum : lus par buildSearchPayload via cast (présents en config, hors type strict).
      costumSlug,
      sourceKey: [costumSlug],
    } as never,
  });
}
