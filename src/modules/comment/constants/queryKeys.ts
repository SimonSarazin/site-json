import type { CommentTarget } from "../types";

/**
 * Clés de cache du module comment.
 *
 * Règle héritée du SSE maison : le hub ne transporte qu'un nom de sujet, jamais de donnée.
 * On invalide donc **par préfixe**, jamais par clé complète — `useHydratedUserContextId` vaut
 * `null` au premier rendu, si bien qu'une clé complète construite trop tôt ne correspond à rien.
 */

/** Segment stable identifiant une cible dans une clé de cache. */
const targetSegment = (target: CommentTarget) =>
  [target.type, target.id, target.path ?? ""] as const;

export const COMMENT_QUERY_KEYS = {
  /**
   * Fil d'une entité.
   *
   * Producteur : `useCommentsQuery`
   * Consommateurs invalidants : `useCommentMutations` via `THREAD_PREFIX`, et `useMarkThreadSeen`
   * (périmé SANS relecture, pour que les repères de non-lu restent pendant la lecture)
   */
  THREAD: (target: CommentTarget, userContextId: string | null = null) =>
    ["comment-thread", ...targetSegment(target), userContextId] as const,
  THREAD_PREFIX: (target: CommentTarget) =>
    ["comment-thread", ...targetSegment(target)] as const,

  /**
   * Fil sans cible résolue : clé de repos, jamais servie — la requête reste désactivée tant
   * qu'il n'y a pas de cible.
   *
   * Producteur : `useCommentsQuery`
   * Consommateurs invalidants : aucun
   */
  THREAD_NONE: () => ["comment-thread", "none"] as const,

  /** Toutes les discussions, tous contextes — sert à l'invalidation large du panneau. */
  ALL_THREADS_PREFIX: () => ["comment-thread"] as const,

  /**
   * Entité porteuse d'un fil ouvert dans le panneau, qui cadre sa recherche de mentions.
   *
   * Producteur : `useCarrierEntity` (lecture seule, gardée 5 min)
   * Consommateurs invalidants : aucun
   */
  CARRIER_ENTITY: (carrier: string, meId: string | null) =>
    ["comment-carrier-entity", carrier, meId] as const,

  /**
   * Votants d'un message (qui a réagi, et comment).
   *
   * Producteur : `useCommentVoters`
   * Consommateurs invalidants : `useToggleReaction` via `VOTERS_PREFIX`
   */
  VOTERS: (commentId: string, userContextId: string | null = null) =>
    ["comment-voters", commentId, userContextId] as const,
  VOTERS_PREFIX: (commentId: string) => ["comment-voters", commentId] as const,

  /**
   * Panneau « Discussions » : rail de porteurs, fils d'un porteur, ou tout le parc — et, sous la
   * profondeur `space`, l'espace de discussion d'un élément (ses fils, titrés et comptés).
   *
   * Producteurs : `useDiscussionsQuery` (`rail`, `carrier`, `thread`, `all`) et
   * `useDiscussionSpaceQuery` (`space`)
   * Consommateurs invalidants, tous via `DISCUSSIONS_PREFIX` : le temps réel
   * (`useDiscussionsRealtime`), `useCommentMutations` (un message posté ou supprimé change les
   * compteurs) et `useMarkThreadSeen` (un fil lu change les non-lus)
   */
  DISCUSSIONS: (depth: string, holder: string | null, userContextId: string | null = null) =>
    ["comment-discussions", depth, holder, userContextId] as const,
  DISCUSSIONS_PREFIX: () => ["comment-discussions"] as const,
} as const;

export type CommentQueryKeyType = ReturnType<
  (typeof COMMENT_QUERY_KEYS)[keyof typeof COMMENT_QUERY_KEYS]
>;
