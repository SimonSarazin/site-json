import { useInfiniteQueryScroll } from "@/hooks/useInfiniteQueryScroll";
import type { EntityTypes, User } from "@communecter/cocolight-api-client";
import { PROFIL_QUERY_KEYS } from "../constants/queryKeys";

interface UseProfilSubscribersQueryProps {
  entity: EntityTypes;
  entityType: string;
  enabled: boolean;
  indexStep?: number;
  searchQuery?: string;
}

const SUBSCRIBERS_SUPPORTED_TYPES = new Set(["citoyens", "organizations", "projects", "events"]);

export function useProfilSubscribersQuery({
  entity,
  entityType,
  enabled,
  indexStep = 12,
  searchQuery = "",
}: UseProfilSubscribersQueryProps) {
  const canFetchSubscribers = SUBSCRIBERS_SUPPORTED_TYPES.has(entityType);

  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    lastItemRef,
    error,
    refetch,
  } = useInfiniteQueryScroll<User[]>({
    queryKey: PROFIL_QUERY_KEYS.PROFILE_SUBSCRIBERS(entity.id ?? null, searchQuery),
    queryFn: async ({ pageParam = 0 }) => {
      if (!canFetchSubscribers) {
        return [];
      }

      const result = await entity.getSubscribers({
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
      enabled: enabled && canFetchSubscribers,
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      initialPageParam: 0,
    },
  });

  const subscribers = data ? data.pages.flatMap((page) => page) : [];

  return {
    subscribers,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    lastItemRef,
    error,
    refetch,
  };
}
