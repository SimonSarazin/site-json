import type { ParentType } from "@/modules/kanban/types";

/**
 * Clés TanStack Query du module kanban — source unique, reprise de co-kanban
 * (`src/lib/queryKeys.ts`) et réduite aux tableaux reliés à l'élément porteur du site.
 *
 * Règles (bonnes pratiques §6) :
 *  1. un seul objet `KANBAN_QUERY_KEYS`, `as const` sur l'objet et sur chaque tableau ;
 *  2. un `*_PREFIX()` par famille pour les invalidations larges ;
 *  3. la DIMENSION UTILISATEUR est obligatoire : les réponses dépendent des droits de la
 *     personne connectée (`capabilities`), et le cache d'un compte ne doit pas être servi au
 *     suivant dans le même onglet. C'est l'id du compte (`useCurrentUserId`), lu après
 *     hydratation : `null` (rendu serveur, premier rendu client) devient `"anonymous"` ;
 *  4. chaque clé documente ses producteurs et ses consommateurs invalidants.
 */

function userDimension(userId: string | null | undefined): string {
  return userId ?? "anonymous";
}

export const KANBAN_QUERY_KEYS = {
  /**
   * Tableau relié à l'élément porteur (`board/create {source:"communecter"}`, idempotent :
   * renvoie le lien existant). Producteur : `useContextBoard`. Jamais invalidé : le lien d'un
   * élément ne change pas tant qu'il existe, et un lien supprimé se recrée à l'identique.
   */
  CONTEXT_BOARD: (userId: string | null, parentType: ParentType, parentId: string) =>
    ["kanban", "context-board", userDimension(userId), parentType, parentId] as const,
  /**
   * Clé de repos, jamais servie : la requête reste désactivée tant que le site n'a pas de
   * porteur organisation ou projet. Producteur : `useContextBoard`. Consommateurs : aucun.
   */
  CONTEXT_BOARD_NONE: () => ["kanban", "context-board", "none"] as const,

  /**
   * Instantané complet d'un tableau (`board/get`).
   * Producteur : `useBoard`. Écrit en place par `useBoardMutations` (optimiste),
   * `useBoardSync` (delta), `useMilestones` et `useCardComments`, d'où l'absence
   * d'invalidation systématique après chaque mutation.
   */
  BOARD: (userId: string | null, boardId: string) => ["kanban", "board", userDimension(userId), boardId] as const,
  /** Préfixe d'invalidation : le tableau, tous utilisateurs confondus. */
  BOARD_PREFIX: () => ["kanban", "board"] as const,

  /**
   * Fil de discussion d'une carte (`comment/list`).
   * Producteur : `useCardComments`. Écrit en place par ses deux mutations ; le compteur, lui,
   * vit sur la carte de l'instantané du tableau.
   *
   * `boardId` fait partie de la clé parce qu'il fait partie de la REQUÊTE : il désigne la
   * source, la même carte ne se lit pas sans lui.
   */
  CARD_COMMENTS: (userId: string | null, boardId: string, cardId: string) =>
    ["kanban", "card-comments", userDimension(userId), boardId, cardId] as const,
  CARD_COMMENTS_PREFIX: () => ["kanban", "card-comments"] as const,
  /**
   * Préfixe d'invalidation : tous les fils d'UN tableau. Utilisé par le polling quand il
   * recharge le tableau : un commentaire écrit dans Communecter n'a pas de ligne de journal,
   * seul ce rechargement le révèle.
   */
  CARD_COMMENTS_OF_BOARD: (userId: string | null, boardId: string) =>
    ["kanban", "card-comments", userDimension(userId), boardId] as const,

  /**
   * Carte COMPLÈTE (`card/get`) d'une fiche dont l'instantané ne porte pas la checklist
   * (`checklistTruncated`). Producteur : `useCardDetail`, lu à CHAQUE ouverture (aucune
   * fraîcheur, aucune rétention) : c'est la base de la fusion à trois. Aucune mutation ne
   * l'écrit : `card/update` répond la carte complète, posée dans l'instantané (`BOARD`).
   */
  CARD: (userId: string | null, boardId: string, cardId: string) =>
    ["kanban", "card", userDimension(userId), boardId, cardId] as const,
  CARD_PREFIX: () => ["kanban", "card"] as const,

  /**
   * Rôles de l'élément vus par son tableau (`role/list`).
   * Producteur : `useRoles`. Écrit en place (optimiste) par `useRoleMutations`, puis INVALIDÉ :
   * par ces mutations à leur règlement, et par le polling delta sur toute activité
   * `role.updated` ou tout rechargement complet — un changement fait dans Communecter n'a pas
   * de ligne de journal fine.
   */
  ROLES: (userId: string | null, boardId: string) => ["kanban", "roles", userDimension(userId), boardId] as const,
  ROLES_PREFIX: () => ["kanban", "roles"] as const,

  /**
   * Jalons du projet (`milestone/list`).
   * Producteur : `useMilestoneList` (boîte de gestion des jalons). Écrit en place par
   * `useMilestoneMutations`, qui tiennent AUSSI à jour la copie de l'instantané (`BOARD`) lue
   * par la fiche de carte.
   */
  MILESTONES: (userId: string | null, boardId: string) =>
    ["kanban", "milestones", userDimension(userId), boardId] as const,
  MILESTONES_PREFIX: () => ["kanban", "milestones"] as const,

  /**
   * Dernières activités d'un tableau (`board/sync` sur une FENÊTRE de révisions), pour la Vue
   * d'ensemble. Producteur : `useBoardActivity`. Jamais invalidé : `rev` est dans la clé, la
   * réponse décrit un état figé du journal, et c'est l'avancée de la révision de l'instantané
   * (mutations, polling delta) qui ouvre une nouvelle entrée.
   */
  BOARD_ACTIVITY: (userId: string | null, boardId: string, rev: number) =>
    ["kanban", "board-activity", userDimension(userId), boardId, rev] as const,
  BOARD_ACTIVITY_PREFIX: () => ["kanban", "board-activity"] as const,
} as const;

export type KanbanBoardKey = ReturnType<typeof KANBAN_QUERY_KEYS.BOARD>;
export type KanbanCardCommentsKey = ReturnType<typeof KANBAN_QUERY_KEYS.CARD_COMMENTS>;
export type KanbanCardKey = ReturnType<typeof KANBAN_QUERY_KEYS.CARD>;
export type KanbanRolesKey = ReturnType<typeof KANBAN_QUERY_KEYS.ROLES>;
export type KanbanMilestonesKey = ReturnType<typeof KANBAN_QUERY_KEYS.MILESTONES>;
