import { useMemo } from "react";
import { formatDistanceToNow } from "date-fns";
import { useDateFnsLocale } from "@/hooks/useDateFnsLocale";
import { useCocolight } from "@/hooks/useCocolight";
import type { Comment, User, Organization, EntityTypes } from "@communecter/cocolight-api-client";
import { useUserPermissions } from "./useUserPermissions";

/**
 * Interface pour une reply formatée
 * Contient les champs calculés + l'objet Comment complet
 */
export interface FormattedReply {
  // Champs calculés
  formattedDate: string;
  totalVotes: number;
  authorName: string;
  authorPhoto: string | null;
  isAuthor: boolean;

  // Permissions
  canEdit: boolean;
  canDelete: boolean;

  // Champs de CommentItemNormalized qu'on utilise
  id: string;
  text: string;

  // L'objet Comment complet pour avoir accès aux méthodes
  comment: Comment;
}

/**
 * Interface pour un commentaire formaté
 * Contient uniquement les champs calculés + les champs utilisés de CommentItemNormalized
 */
export interface FormattedComment {
  // Champs calculés
  authorName: string;
  authorPhoto: string | null;
  isAuthor: boolean;
  formattedDate: string;
  totalVotes: number;
  replies: FormattedReply[];
  repliesCount: number;

  // Permissions
  canEdit: boolean;
  canDelete: boolean;

  // Champs de CommentItemNormalized qu'on utilise
  id: string;
  text: string;
}

/**
 * Vérifie si un objet est une entité (User ou Organization) avec serverData
 */
function isEntityInstance(obj: unknown): obj is User | Organization {
  return obj !== null && typeof obj === "object" && "serverData" in obj;
}

/**
 * Extrait les informations d'un auteur (peut être un objet brut ou une entité)
 */
function extractAuthorInfo(author: unknown): {
  id: string;
  name: string;
  photo: string | null;
} {
  // Si c'est une entité avec serverData
  if (isEntityInstance(author)) {
    return {
      id: author.serverData?.id || "",
      name: author.serverData?.name || "Anonyme",
      photo: author.serverData?.profilThumbImageUrl || null,
    };
  }

  // Si c'est un objet brut (cas des replies)
  if (author && typeof author === "object") {
    const authorObj = author as Record<string, unknown>;
    return {
      id: (authorObj.id as string) || "",
      name: (authorObj.name as string) || "Anonyme",
      photo: (authorObj.profilThumbImageUrl as string) || null,
    };
  }

  // Fallback
  return {
    id: "",
    name: "Anonyme",
    photo: null,
  };
}

/**
 * Calcule le total des votes à partir de voteCount
 */
function calculateTotalVotes(voteCount?: Record<string, number> | null): number {
  if (!voteCount || typeof voteCount !== "object") return 0;
  return Object.values(voteCount).reduce((sum, count) => sum + count, 0);
}

/**
 * Hook pour formater les données d'un commentaire
 * Extrait et simplifie l'accès aux données complexes du Comment
 * @param commentItem - Le commentaire à formater
 * @param entity - L'entité propriétaire (pour calculer les permissions)
 */
export function useFormatComment(commentItem: Comment | null, entity: EntityTypes | null = null): FormattedComment | null {
  const dateFnsLocale = useDateFnsLocale();
  const { me } = useCocolight();
  const permissions = useUserPermissions(entity);

  const currentUserId = me?.serverData?.id;

  return useMemo(() => {
    if (!commentItem || !commentItem.serverData) return null;

    const { serverData } = commentItem;

    // Extraction des infos de l'auteur principal
    const authorInfo = extractAuthorInfo(serverData.author);

    // Gestion du created qui peut être Date ou number
    const createdDate = serverData.created instanceof Date
      ? serverData.created
      : typeof serverData.created === 'number'
        ? new Date(serverData.created)
        : new Date();

    // Formatage de la date
    const formattedDate = formatDistanceToNow(createdDate, {
      addSuffix: true,
      locale: dateFnsLocale,
    });

    // Calcul du total des votes
    const voteCount = serverData.voteCount && typeof serverData.voteCount === 'object'
      ? serverData.voteCount as Record<string, number>
      : {};
    const totalVotes = calculateTotalVotes(voteCount);

    // Formatage des replies (maintenant ce sont des objets Comment)
    const formattedReplies: FormattedReply[] = [];
    if (serverData.replies && Array.isArray(serverData.replies)) {
      serverData.replies.forEach((reply) => {
        // Les replies sont maintenant des objets Comment
        if (reply && typeof reply === "object" && "serverData" in reply) {
          const replyComment = reply as unknown as Comment;
          const replyServerData = replyComment.serverData;

          if (!replyServerData) return;

          const replyAuthorInfo = extractAuthorInfo(replyServerData.author);

          const replyVoteCount = replyServerData.voteCount && typeof replyServerData.voteCount === 'object'
            ? replyServerData.voteCount as Record<string, number>
            : {};

          // Gérer created qui peut être Date ou number
          const replyCreated = replyServerData.created instanceof Date
            ? replyServerData.created
            : typeof replyServerData.created === 'number'
              ? new Date(replyServerData.created)
              : new Date();

          const isReplyAuthor = replyAuthorInfo.id === currentUserId;

          const formattedReply: FormattedReply = {
            authorName: replyAuthorInfo.name,
            authorPhoto: replyAuthorInfo.photo,
            formattedDate: formatDistanceToNow(replyCreated, {
              addSuffix: true,
              locale: dateFnsLocale,
            }),
            totalVotes: calculateTotalVotes(replyVoteCount),
            isAuthor: isReplyAuthor,
            canEdit: isReplyAuthor, // Peut éditer si auteur de la reply
            canDelete: isReplyAuthor || permissions.canModerateNews, // Auteur ou modérateur du profil
            id: replyServerData.id,
            text: typeof replyServerData.text === 'string' ? replyServerData.text : '',
            comment: replyComment, // Inclure l'objet Comment complet
          };

          formattedReplies.push(formattedReply);
        }
      });
    }

    // Vérifier permissions pour le commentaire principal
    const isCommentAuthor = authorInfo.id === currentUserId;

    // Construire le commentaire formaté avec uniquement les champs nécessaires
    const formattedComment: FormattedComment = {
      authorName: authorInfo.name,
      authorPhoto: authorInfo.photo,
      isAuthor: isCommentAuthor,
      formattedDate,
      totalVotes,
      replies: formattedReplies,
      repliesCount: formattedReplies.length,
      canEdit: isCommentAuthor, // Peut éditer si auteur du commentaire
      canDelete: isCommentAuthor || permissions.canModerateNews, // Auteur ou modérateur du profil
      id: serverData.id,
      text: typeof serverData.text === 'string' ? serverData.text : '',
    };

    return formattedComment;
  }, [commentItem, dateFnsLocale, currentUserId, permissions]);
}
