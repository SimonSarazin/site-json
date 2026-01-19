import type { QueryClient } from "@tanstack/react-query";
import type { EntityTypes } from "@communecter/cocolight-api-client";
import { NEWS_QUERY_KEYS } from "../constants/queryKeys";

export async function prefetchNewsQuery(
  queryClient: QueryClient,
  entity: EntityTypes,
  indexStep = 12
): Promise<void> {
  await queryClient.prefetchInfiniteQuery({
    queryKey: NEWS_QUERY_KEYS.NEWS(entity.id ?? null),
    queryFn: async () => {
      return entity.getNews({ indexStep });
    },
    initialPageParam: undefined,
  });
}
