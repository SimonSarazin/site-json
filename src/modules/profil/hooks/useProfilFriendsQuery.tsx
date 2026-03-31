import { useInfiniteQueryScroll } from "@/hooks/useInfiniteQueryScroll";
import type { EntityTypes, User } from "@communecter/cocolight-api-client";
import { useState } from "react";

export type FriendStatus = "all" | "confirmed" | "pending" | "sent";

interface UseProfilFriendsQueryProps {
  entity: EntityTypes;
  entityType: string;
  enabled: boolean;
  indexStep?: number;
  searchQuery?: string;
  status?: FriendStatus;
}

const FRIENDS_SUPPORTED_TYPES = new Set(["citoyens"]);

function buildStatusFilters(entityId: string, status: FriendStatus): Record<string, unknown> {
  if (status === "pending") {
    return {
      filters: {
        [`links.friends.${entityId}`]: { "$exists": true },
        [`links.friends.${entityId}.toBeValidated`]: { "$exists": true },
        [`links.friends.${entityId}.isInviting`]: { "$exists": false },
      },
    };
  } else if (status === "sent") {
    return {
      filters: {
        [`links.friends.${entityId}`]: { "$exists": true },
        [`links.friends.${entityId}.isInviting`]: { "$exists": true },
      },
    };
  } else if (status === "confirmed") {
    return {
      filters: {
        [`links.friends.${entityId}`]: { "$exists": true },
        [`links.friends.${entityId}.toBeValidated`]: { "$exists": false },
        [`links.friends.${entityId}.isInviting`]: { "$exists": false },
      },
    };
  }
  return {};
}

export function useProfilFriendsQuery({
  entity,
  entityType,
  enabled,
  indexStep = 12,
  searchQuery = "",
  status = "all",
}: UseProfilFriendsQueryProps) {
  const canFetchFriends = FRIENDS_SUPPORTED_TYPES.has(entityType);
  const [totalCount, setTotalCount] = useState<number>(0);

  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    lastItemRef,
    error,
    refetch,
  } = useInfiniteQueryScroll<User[]>({
    queryKey: ["profile-friends", entity?.id, searchQuery, status],
    queryFn: async ({ pageParam = 0 }) => {
      if (!canFetchFriends || !entity?.id) {
        return [];
      }

      const statusFilters = buildStatusFilters(entity.id, status);

      const params: Record<string, unknown> = {
        indexMin: pageParam as number,
        indexStep,
        ...statusFilters,
      };

      if (searchQuery) {
        params.name = searchQuery;
      }

      const result = await (entity as unknown as { getFriends(params: Record<string, unknown>): Promise<{ results?: User[]; totalCount?: number }> }).getFriends(params);

      if (result.totalCount !== undefined) {
        setTotalCount(result.totalCount);
      }

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
      enabled: enabled && canFetchFriends && !!entity?.id,
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      initialPageParam: 0,
    },
  });

  const friends = data ? data.pages.flatMap((page) => page) : [];

  return {
    friends,
    totalCount,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    lastItemRef,
    error,
    refetch,
  };
}
