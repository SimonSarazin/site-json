import { useMemo } from "react";

import { isPlainObj } from "@/lib/costumLists";
import { SEARCH_QUERY_KEYS } from "@/modules/search/constants/queryKeys";
import { useSearchQuery } from "@/modules/search/hooks/useSearchQuery";
import { parseCoformAnswer } from "@/modules/search/lib/coformAnswer";

import { NO_TAGS, SEARCH_TYPE_ANSWERS } from "../components/structures/constants";

type ManagedAnswersParams = Parameters<typeof useSearchQuery>[0]["baseParams"];

/**
 * Une liste de créneaux de l'onglet « Structures » (ceux d'une structure, ou ceux déposés ailleurs) :
 * la recherche sous le préfixe PARTAGÉ du compte (`MANAGED_ANSWERS_PREFIX` — chaque liste se
 * distingue par ses filtres, qui sont dans la clé), et chaque résultat lu une fois (`parseCoformAnswer`).
 */
export function useManagedAnswers(userId: string, baseParams: ManagedAnswersParams, enabled: boolean) {
  const query = useSearchQuery({
    queryKeyPrefix: SEARCH_QUERY_KEYS.MANAGED_ANSWERS_PREFIX(userId),
    searchText: "",
    searchTags: NO_TAGS,
    searchType: SEARCH_TYPE_ANSWERS,
    mapUsed: false,
    enabled,
    baseParams,
  });
  const rows = useMemo(
    () =>
      query.transformedResults.map((item) => {
        const serverData = isPlainObj(item.serverData) ? item.serverData : {};
        return { item, serverData, answer: parseCoformAnswer(serverData) };
      }),
    [query.transformedResults],
  );
  return { ...query, rows };
}
