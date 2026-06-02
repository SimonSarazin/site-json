import { useMemo } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useHydratedUserContextId } from "@/hooks/useHydratedUserContextId";
import type { User, Notification } from "@communecter/cocolight-api-client";
import { NOTIFICATION_QUERY_KEYS } from "../constants/queryKeys";

/** Taille de page serveur (ActivityStream::getNotificationsByStep indexStep). */
const PAGE_SIZE = 15;

/**
 * Liste paginée des notifications.
 *
 * On **cache les instances vivantes** `Notification[]` (via `me.notifications.toItems`)
 * — comme les BaseEntity ailleurs — et on **n'utilise PAS `select`** : `select`
 * recrée des instances à chaque render, ce qui perd la mutation optimiste de
 * `item.markRead()`. Ici les instances restent dans le cache, donc un
 * `item.markRead()` (flip optimiste de l'état réactif interne) **persiste** au
 * re-render et à la réouverture du panneau.
 *
 * La cloche est client-only (auth-gated, jamais rendue au SSR) → pas de souci de
 * déhydratation à mettre des instances dans le cache.
 *
 * `structuralSharing: false` : RQ ne doit pas tenter de fusionner les instances.
 */
export function useNotificationsList(me: User | null) {
  const userContextId = useHydratedUserContextId();
  const userId = me?.id ?? null;

  const query = useInfiniteQuery({
    queryKey: NOTIFICATION_QUERY_KEYS.LIST(userId, userContextId),
    enabled: !!me?.isConnected,
    initialPageParam: 0,
    structuralSharing: false,
    staleTime: 1000 * 30,
    gcTime: 1000 * 60 * 5,
    queryFn: async ({ pageParam }): Promise<Notification[]> => {
      if (!me) return [];
      const flat = await me.fetchNotifications({ indexMin: pageParam as number });
      return me.notifications.toItems(flat);
    },
    // indexMin de la page suivante = nombre d'items déjà chargés (curseur).
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.length < PAGE_SIZE) return undefined;
      return allPages.reduce((total, page) => total + page.length, 0);
    },
  });

  const items = useMemo<Notification[]>(() => query.data?.pages.flat() ?? [], [query.data]);

  return {
    items,
    isLoading: query.isLoading,
    isFetchingNextPage: query.isFetchingNextPage,
    hasNextPage: query.hasNextPage,
    fetchNextPage: query.fetchNextPage,
    refetch: query.refetch,
    error: query.error,
  };
}
