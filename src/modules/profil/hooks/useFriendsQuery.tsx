import { useInfiniteQueryScrollNext } from "@/hooks/useInfiniteQueryScroll";
import type { EntityTypes, User } from "@communecter/cocolight-api-client";
import { isUser } from "@/lib/getTypedEntity";
import { useMemo } from "react";

export interface FriendsQueryParams {
  indexStep?: number;
  search?: string;
  status?: "all" | "pending" | "friends" | "sent";
}

/**
 * Hook pour récupérer les amis d'un utilisateur
 */
export function useFriendsQuery(user: EntityTypes | null, params?: FriendsQueryParams) {
  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    lastItemRef,
    error,
    refetch,
  } = useInfiniteQueryScrollNext<User[]>({
    queryKey: ["user-friends", user?.slug, params],
    queryFn: async ({ pageParam }) => {
      if (!user || !isUser(user)) {
        throw new Error("User is required");
      }

      const page = pageParam as { pageNumber?: number; next?: () => Promise<{ results: any[]; count: any; hasNext: boolean; pageNumber: number; next?: () => Promise<any> }> } | undefined;

      let filters = {};

      if (params?.status === "pending") {
        // Invitations en attente reçues (toBeValidated mais pas isInviting)
        filters = {
          filters: {
            [`links.friends.${user.id}`]: {
              "$exists": true
            },
            [`links.friends.${user.id}.toBeValidated`]: {
              "$exists": true
            },
            [`links.friends.${user.id}.isInviting`]: {
              "$exists": false
            }
          }
        };
      } else if (params?.status === "sent") {
        // Invitations envoyées (isInviting existe)
        filters = {
          filters: {
            [`links.friends.${user.id}`]: {
              "$exists": true
            },
            [`links.friends.${user.id}.isInviting`]: {
              "$exists": true
            }
          }
        };
      } else if (params?.status === "friends") {
        // Amis confirmés (ni toBeValidated ni isInviting)
        filters = {
          filters: {
            [`links.friends.${user.id}`]: {
              "$exists": true
            },
            [`links.friends.${user.id}.toBeValidated`]: {
              "$exists": false
            },
            [`links.friends.${user.id}.isInviting`]: {
              "$exists": false
            }
          }
        };
      } else {
        // "all" - tous les amis (avec ou sans toBeValidated/isInviting)
        filters = {
          filters: {
            [`links.friends.${user.id}`]: {
              "$exists": true
            }
          }
        };
      }

      // Utiliser la vraie méthode API
      const result = await user.getFriends({
        name: params?.search,
        indexMin: 0,
        indexStep: params?.indexStep || 20,
        ...filters
      });

      // Use next() function if available and we're on a subsequent page
      if (
        page &&
        page.pageNumber &&
        page.pageNumber > 1 &&
        typeof page.next !== "function" &&
        result.next
      ) {
        return result.next();
      }

      return result;
    },
    options: {
      enabled: !!(user && isUser(user)),
      staleTime: 5 * 60 * 1000, // 5 minutes
      initialPageParam: undefined
    }
  });

  const friends = useMemo(() => {
    if (!data) return [];
    return data.pages.flatMap(page => page.results);
  }, [data]);

  const totalCount = useMemo(() => {
    if (!data || data.pages.length === 0) return 0;
    return data.pages[0].count?.total || 0;
  }, [data]);

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