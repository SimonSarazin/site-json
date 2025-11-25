import { useInfiniteQueryScroll } from "@/hooks/useInfiniteQueryScroll";
import type { EntityTypes } from "@communecter/cocolight-api-client";

interface UseProfilSubscriptionsQueryProps {
  entity: EntityTypes;
  entityType: string;
  enabled: boolean;
  indexStep?: number;
  searchQuery?: string;
}

const SUBSCRIPTIONS_SUPPORTED_TYPES = new Set(["citoyens"]);

export function useProfilSubscriptionsQuery({
  entity,
  entityType,
  enabled,
  indexStep = 12,
  searchQuery = "",
}: UseProfilSubscriptionsQueryProps) {
  const canFetchSubscriptions = SUBSCRIPTIONS_SUPPORTED_TYPES.has(entityType);

  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    lastItemRef,
    error,
    refetch,
  } = useInfiniteQueryScroll<EntityTypes[]>({
    queryKey: ["profile-subscriptions", entity.id, searchQuery],
    queryFn: async ({ pageParam = 0 }) => {
      if (!canFetchSubscriptions) {
        return [];
      }

      const result = await (entity as any).getSubscriptions({
        indexMin: pageParam as number,
        indexStep,
        ...(searchQuery ? { name: searchQuery } : {}),
      });

      return result.results || [];
    },
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.length < indexStep) {
        return undefined;
      }

      const currentIndex = allPages.reduce((acc, page) => acc + page.length, 0);
      return currentIndex;
    },
    options: {
      enabled: enabled && canFetchSubscriptions,
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000, // Garder en cache 30 minutes même si démonté
      initialPageParam: 0,
    },
  });

  const subscriptions = data ? data.pages.flatMap((page) => page) : [];

  return {
    subscriptions,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    lastItemRef,
    error,
    refetch,
  };
}
