import { useQuery } from "@tanstack/react-query";
import { useHydratedUserContextId } from "@/hooks/useHydratedUserContextId";
import type { User } from "@communecter/cocolight-api-client";
import { NOTIFICATION_QUERY_KEYS } from "../constants/queryKeys";

/**
 * Badge (compteur des notifications NON VUES) — query dédiée, polling 30s.
 *
 * SOURCE DE VÉRITÉ du badge : on lit toujours `me.fetchNotificationsCount()`
 * (stateless), JAMAIS `me.notifications.unseenTotal` / `loadedUnreadCount`
 * (le manager ne connaît que la dernière page chargée).
 */
export function useUnseenBadge(me: User | null) {
  const userContextId = useHydratedUserContextId();
  const userId = me?.id ?? null;

  const query = useQuery({
    queryKey: NOTIFICATION_QUERY_KEYS.BADGE(userId, userContextId),
    enabled: !!me?.isConnected,
    queryFn: () => me!.fetchNotificationsCount(),
    refetchInterval: 1000 * 30,
    refetchIntervalInBackground: false,
    staleTime: 1000 * 20,
  });

  return { count: query.data ?? 0, isLoading: query.isLoading };
}
