import { useInfiniteQueryScrollNextWithTransform } from "@/hooks/useInfiniteQueryScroll";
import type { EntityTypes, User, PaginatorPage } from "@communecter/cocolight-api-client";
import { isUser } from "@/lib/getTypedEntity";
import { useMemo } from "react";
import type { FriendsQueryParams } from "../types";
import { PROFIL_QUERY_KEYS } from "../constants/queryKeys";
import { useHydratedUserContextId } from "@/hooks/useHydratedUserContextId";
import { useCocolight } from "@/hooks/useCocolight";

export type { FriendsQueryParams };

/**
 * Hook pour récupérer les amis d'un utilisateur
 */
export function useFriendsQuery(user: EntityTypes | null, params?: FriendsQueryParams) {
  // userContextId compatible SSR : null au premier render, puis la vraie valeur après hydratation
  const userContextId = useHydratedUserContextId();
  const { helper } = useCocolight();

  const {
    data,
    totalCount,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    lastItemRef,
    error,
    refetch,
  } = useInfiniteQueryScrollNextWithTransform<User>({
    queryKey: [...PROFIL_QUERY_KEYS.USER_FRIENDS(user?.slug ?? null, userContextId), params],
    queryFn: async ({ pageParam }) => {
      if (!user || !isUser(user)) {
        throw new Error("User is required");
      }

      const page = pageParam as PaginatorPage<User> | undefined;

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
    },
    // Transformation SSR - user vient du paramètre, pas de useCocolight()
    transform: user ? { entity: user, helper } : undefined,
  });

  const friends = useMemo(() => {
    if (!data) return [];
    return data.pages.flatMap(page => page.results);
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