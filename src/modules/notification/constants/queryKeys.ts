/**
 * Query keys du module notification — centralisés (single source of truth).
 *
 * Convention identique au module news : chaque producteur a sa clé complète
 * (avec `userContextId` pour refetch auto au changement de contexte
 * logout/login) + une variante `_PREFIX` minimaliste pour invalidation
 * cross-contexte.
 */
export const NOTIFICATION_QUERY_KEYS = {
  /**
   * Liste paginée des notifications de l'utilisateur connecté.
   *
   * Producteur : `useNotificationsList`
   * Consommateurs invalidants : `useNotificationMutations`
   *   (markAllRead/clearAll) via `LIST_PREFIX`.
   */
  LIST: (userId: string | null, userContextId: string | null = null) =>
    ["notifications", userId, userContextId] as const,
  /** Préfixe pour invalidations (matche toutes les variantes peu importe userContextId). */
  LIST_PREFIX: (userId: string | null) => ["notifications", userId] as const,

  /**
   * Compteur de notifications NON VUES (badge).
   *
   * Producteur : `useUnseenBadge`
   * Consommateurs invalidants : `useNotificationMutations`
   *   (markAllRead/clearAll/markAllSeen) via `BADGE_PREFIX`.
   */
  BADGE: (userId: string | null, userContextId: string | null = null) =>
    ["notifications-badge", userId, userContextId] as const,
  /** Préfixe pour invalidations. */
  BADGE_PREFIX: (userId: string | null) => ["notifications-badge", userId] as const,
} as const;

export type NotificationQueryKeyType = ReturnType<
  (typeof NOTIFICATION_QUERY_KEYS)[keyof typeof NOTIFICATION_QUERY_KEYS]
>;
