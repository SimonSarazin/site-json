import { useInfiniteQueryScroll } from "@/hooks/useInfiniteQueryScroll";
import type { EntityTypes, User } from "@communecter/cocolight-api-client";

interface UseProfilFriendsQueryProps {
  entity: EntityTypes;
  entityType: string;
  enabled: boolean;
  indexStep?: number;
  searchQuery?: string;
}

const FRIENDS_SUPPORTED_TYPES = new Set(["citoyens"]);

export function useProfilFriendsQuery({
  entity,
  entityType,
  enabled,
  indexStep = 12,
  searchQuery = "",
}: UseProfilFriendsQueryProps) {
  const canFetchFriends = FRIENDS_SUPPORTED_TYPES.has(entityType);

  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    lastItemRef,
    error,
    refetch,
  } = useInfiniteQueryScroll<User[]>({
    queryKey: ["profile-friends", entity.id, searchQuery],
    queryFn: async ({ pageParam = 0 }) => {
      if (!canFetchFriends) {
        return [];
      }

      const params: Record<string, unknown> = {
        indexMin: pageParam as number,
        indexStep,
      };

      if (searchQuery) {
        params.name = searchQuery;
      }

      const result = await (entity as any).getFriends(params);

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
      enabled: enabled && canFetchFriends,
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      initialPageParam: 0,
    },
  });

  const friends = data ? data.pages.flatMap((page) => page) : [];

  return {
    friends,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    lastItemRef,
    error,
    refetch,
  };
}
