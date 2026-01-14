import { useMemo } from "react";
import { formatDistanceToNow } from "date-fns";
import { useDateFnsLocale } from "@/hooks/useDateFnsLocale";
import { useCocolight } from "@/hooks/useCocolight";
import type { Comment, EntityTypes } from "@communecter/cocolight-api-client";
import { useNewsPermissions } from "./useNewsPermissions";
import { extractAuthorInfo, calculateTotalVotes } from "@/lib/entityFormatting";

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
  voteCount: Record<string, number>;
  userVoteType: string | null;

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
  voteCount: Record<string, number>;
  userVoteType: string | null;
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
 * Hook pour formater les données d'un commentaire
 * Extrait et simplifie l'accès aux données complexes du Comment
 * @param commentItem - Le commentaire à formater
 * @param entity - L'entité propriétaire (pour calculer les permissions)
 */
export function useFormatComment(commentItem: Comment | null, entity: EntityTypes | null = null): FormattedComment | null {
  const dateFnsLocale = useDateFnsLocale();
  const { me } = useCocolight();
  const permissions = useNewsPermissions(entity);

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

    const userVoteType = getUserVoteType(serverData as Record<string, unknown>, currentUserId);

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
      voteCount,
      userVoteType,
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