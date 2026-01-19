import type { Comment } from "@communecter/cocolight-api-client";

/**
 * Utilitaires pour la gestion du cache des commentaires
 * Migré depuis modules/news/utils/commentCacheUtils.ts
 *
 * Fonctions pour manipuler l'arbre de commentaires en mémoire
 * afin d'optimiser les updates sans refetch complet.
 */

/**
 * Trouve et retire récursivement un commentaire/reply de l'arbre
 * @param comments - Liste des commentaires de niveau racine
 * @param commentId - ID du commentaire à retirer
 * @returns Nouvelle liste sans le commentaire
 */
export function findAndRemoveComment(
  comments: Comment[],
  commentId: string
): Comment[] {
  return comments.reduce((acc, comment) => {
    // Si c'est le commentaire à supprimer, on ne l'ajoute pas
    if (comment.id === commentId) {
      return acc;
    }

    // Si le commentaire a des replies, on les parcourt récursivement
    if (comment.serverData?.replies && Array.isArray(comment.serverData.replies)) {
      const replies = comment.serverData.replies as unknown as Comment[];
      const updatedReplies = findAndRemoveComment(replies, commentId);

      // Si des replies ont changé, mettre à jour le commentaire
      if (updatedReplies.length !== replies.length) {
        comment.serverData.replies = updatedReplies as unknown as typeof comment.serverData.replies;
      }
    }

    acc.push(comment);
    return acc;
  }, [] as Comment[]);
}

/**
 * Trouve et met à jour récursivement un commentaire dans l'arbre
 * @param comments - Liste des commentaires de niveau racine
 * @param commentId - ID du commentaire à mettre à jour
 * @param newText - Nouveau texte du commentaire
 * @returns Nouvelle liste avec le commentaire mis à jour
 */
export function findAndUpdateComment(
  comments: Comment[],
  commentId: string,
  newText: string
): Comment[] {
  return comments.map((comment) => {
    // Si c'est le commentaire à modifier
    if (comment.id === commentId && comment.serverData) {
      comment.serverData.text = newText;
      return comment;
    }

    // Si le commentaire a des replies, on les parcourt récursivement
    if (comment.serverData?.replies && Array.isArray(comment.serverData.replies)) {
      const replies = comment.serverData.replies as unknown as Comment[];
      const updatedReplies = findAndUpdateComment(replies, commentId, newText);
      comment.serverData.replies = updatedReplies as unknown as typeof comment.serverData.replies;
    }

    return comment;
  });
}

/**
 * Trouve récursivement un commentaire parent et ajoute une reply
 * @param comments - Liste des commentaires de niveau racine
 * @param parentId - ID du commentaire parent
 * @param newReply - Nouvelle reply à ajouter
 * @returns Nouvelle liste avec la reply ajoutée
 */
export function findAndAddReply(
  comments: Comment[],
  parentId: string,
  newReply: Comment
): Comment[] {
  return comments.map((comment) => {
    // Si c'est le commentaire parent
    if (comment.id === parentId && comment.serverData) {
      const currentReplies = comment.serverData.replies as unknown as Comment[] || [];
      comment.serverData.replies = [...currentReplies, newReply] as unknown as typeof comment.serverData.replies;
      return comment;
    }

    // Si le commentaire a des replies, on les parcourt récursivement
    if (comment.serverData?.replies && Array.isArray(comment.serverData.replies)) {
      const replies = comment.serverData.replies as unknown as Comment[];
      const updatedReplies = findAndAddReply(replies, parentId, newReply);
      comment.serverData.replies = updatedReplies as unknown as typeof comment.serverData.replies;
    }

    return comment;
  });
}

/**
 * Compte récursivement le nombre total de comments/replies dans l'arbre
 * @param comments - Liste des commentaires
 * @returns Nombre total de comments
 */
export function countAllComments(comments: Comment[]): number {
  return comments.reduce((total, comment) => {
    let count = 1; // Le commentaire lui-même

    if (comment.serverData?.replies && Array.isArray(comment.serverData.replies)) {
      const replies = comment.serverData.replies as unknown as Comment[];
      count += countAllComments(replies);
    }

    return total + count;
  }, 0);
}

/**
 * Trouve la profondeur maximale de l'arbre de commentaires
 * @param comments - Liste des commentaires
 * @param currentDepth - Profondeur actuelle (usage interne)
 * @returns Profondeur maximale
 */
export function getMaxDepth(comments: Comment[], currentDepth: number = 0): number {
  if (comments.length === 0) return currentDepth;

  let maxDepth = currentDepth;

  comments.forEach((comment) => {
    if (comment.serverData?.replies && Array.isArray(comment.serverData.replies)) {
      const replies = comment.serverData.replies as unknown as Comment[];
      const depth = getMaxDepth(replies, currentDepth + 1);
      maxDepth = Math.max(maxDepth, depth);
    }
  });

  return maxDepth;
}