import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMutationWithToast } from "@/hooks/useMutationWithToast";
import type { User } from "@communecter/cocolight-api-client";
import { NOTIFICATION_QUERY_KEYS } from "../constants/queryKeys";

/**
 * Mutations de collection (transport pur + invalidation), via le helper projet
 * `useMutationWithToast` (toast i18n succès/erreur + invalidation après succès).
 *
 * En Voie A/Hybride, l'optimisme par item est porté par l'instance
 * (`Notification.markRead()`, voir `NotificationRow`). Ici on N'invalide la liste
 * qu'APRÈS succès — un refetch avant le commit serveur recréerait des instances
 * "non lues" (flicker, cf. `structuralSharing: false`).
 */
export function useNotificationMutations(me: User | null) {
  const queryClient = useQueryClient();
  const userId = me?.id ?? null;

  // Les préfixes (sans userContextId) matchent toutes les variantes de clé peu
  // importe le contexte utilisateur (invalidation par préfixe = comportement RQ).
  const invalidateQueries = [
    NOTIFICATION_QUERY_KEYS.LIST_PREFIX(userId),
    NOTIFICATION_QUERY_KEYS.BADGE_PREFIX(userId),
  ];

  const markAllRead = useMutationWithToast<unknown>({
    mutationFn: () => me!.markAllNotifications("read"),
    successKey: "toast.markAllReadSuccess",
    errorKey: "toast.error",
    invalidateQueries,
    namespace: "modules/notification",
  });

  const clearAll = useMutationWithToast<unknown>({
    mutationFn: () => me!.removeAllNotifications(),
    successKey: "toast.clearAllSuccess",
    errorKey: "toast.error",
    invalidateQueries,
    namespace: "modules/notification",
  });

  // Vidage visuel du badge à l'ouverture du panneau : silencieux (pas de toast,
  // pas d'invalidation de liste) → on garde un useMutation brut.
  const markAllSeen = useMutation({
    mutationFn: () => me!.markAllNotifications("seen"),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: NOTIFICATION_QUERY_KEYS.BADGE_PREFIX(userId),
      }),
  });

  return { markAllRead, clearAll, markAllSeen };
}
