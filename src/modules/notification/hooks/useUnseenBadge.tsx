import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useHydratedUserContextId } from "@/hooks/useHydratedUserContextId";
import { useRealtimeTopics } from "@/hooks/useRealtimeTopics";
import type { User } from "@communecter/cocolight-api-client";
import { NOTIFICATION_QUERY_KEYS } from "../constants/queryKeys";

/** Le topic émis par le hub pour `activityStreamReference` (cocolight `src/realtime/index.ts`). */
const TOPIC_NOTIFICATION = "notification.changed";

/** Filet quand le temps réel est en place : on garde un poll très lent plutôt que de le couper. */
const POLL_TEMPS_REEL_MS = 1000 * 60 * 5;
/** Sans temps réel, l'intervalle historique. C'est LUI la latence perçue, pas la requête. */
const POLL_DEGRADE_MS = 1000 * 30;

/**
 * Badge (compteur des notifications NON VUES).
 *
 * SOURCE DE VÉRITÉ du badge : on lit toujours `me.fetchNotificationsCount()`
 * (stateless), JAMAIS `me.notifications.unseenTotal` / `loadedUnreadCount`
 * (le manager ne connaît que la dernière page chargée).
 *
 * ── TEMPS RÉEL ──────────────────────────────────────────────────────────────────────────────
 * Le vrai grief n'a jamais été la requête (mesurée à 11 ms une fois les index posés) mais la
 * FENÊTRE de 30 s entre deux interrogations. Le hub la supprime en poussant un simple nom de
 * topic ; on invalide alors la query, et React Query refetch.
 *
 * On n'éteint PAS le poll pour autant : on l'allonge à 5 min. Un flux peut mourir sans qu'aucun
 * des deux bouts s'en aperçoive (proxy qui coupe en silence), et un badge muet est pire qu'un
 * badge lent.
 *
 * ⚠️ On invalide le BADGE seulement, et par PRÉFIXE :
 *  · le préfixe, parce que `useHydratedUserContextId` rend `null` au premier rendu — une clé
 *    complète manquerait la variante déjà en cache ;
 *  · le badge seulement, parce que le cache de la LISTE contient des instances `Notification`
 *    vivantes (`structuralSharing:false`) : les invalider en masse ferait perdre l'état local
 *    des lignes déjà affichées.
 */
export function useUnseenBadge(me: User | null) {
  const userContextId = useHydratedUserContextId();
  const userId = me?.id ?? null;
  const queryClient = useQueryClient();

  const rafraichir = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: NOTIFICATION_QUERY_KEYS.BADGE_PREFIX(userId),
      refetchType: "active",
    });
  }, [queryClient, userId]);

  const surTopic = useCallback(
    (topic: string) => { if (topic === TOPIC_NOTIFICATION) rafraichir(); },
    [rafraichir],
  );

  const { etat } = useRealtimeTopics({
    jeton: me?.isConnected ? (me.apiClient?.getToken?.() ?? null) : null,
    actif: !!me?.isConnected,
    surTopic,
    // Le disjoncteur du hub s'est ouvert : il ne dit plus quoi rafraîchir, on refait le point.
    surResync: rafraichir,
  });

  const query = useQuery({
    queryKey: NOTIFICATION_QUERY_KEYS.BADGE(userId, userContextId),
    enabled: !!me?.isConnected,
    queryFn: () => me!.fetchNotificationsCount(),
    // `connecte` SEULEMENT : sur `degrade`, le flux est ouvert mais le bus ne porte plus rien, et
    // rester sur l'intervalle lent rendrait le badge moins réactif qu'avant le temps réel.
    refetchInterval: etat === "connecte" ? POLL_TEMPS_REEL_MS : POLL_DEGRADE_MS,
    refetchIntervalInBackground: false,
    staleTime: 1000 * 20,
  });

  return { count: query.data ?? 0, isLoading: query.isLoading, tempsReel: etat };
}
