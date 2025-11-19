import { useMemo } from "react";
import { formatDistanceToNow } from "date-fns";
import { useDateFnsLocale } from "@/hooks/useDateFnsLocale";
import { useCocolight } from "@/hooks/useCocolight";
import type { Comment, User, Organization } from "@communecter/cocolight-api-client";

/**
 * Interface pour une reply formatée
 * Contient uniquement les champs calculés + les champs utilisés de CommentItemNormalized
 */
export interface FormattedReply {
  // Champs calculés
  formattedDate: string;
  totalVotes: number;
  authorName: string;
  authorPhoto: string | null;
  isAuthor: boolean;

  // Champs de CommentItemNormalized qu'on utilise
  id: string;
  text: string;
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
 */
export function useFormatComment(commentItem: Comment | null): FormattedComment | null {
  const dateFnsLocale = useDateFnsLocale();
  const { me } = useCocolight();

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

    // Formatage des replies
    const formattedReplies: FormattedReply[] = [];
    if (serverData.replies && Array.isArray(serverData.replies)) {
      serverData.replies.forEach((reply) => {
        // Les replies sont des objets normalisés
        if (reply && typeof reply === "object") {
          const replyObj = reply as Record<string, unknown>;
          const replyAuthorInfo = extractAuthorInfo(replyObj.author);

          const replyVoteCount = replyObj.voteCount && typeof replyObj.voteCount === 'object'
            ? replyObj.voteCount as Record<string, number>
            : {};

          // Gérer created qui peut être Date ou number
          const replyCreated = replyObj.created instanceof Date
            ? replyObj.created
            : typeof replyObj.created === 'number'
              ? new Date(replyObj.created)
              : new Date();

          const formattedReply: FormattedReply = {
            authorName: replyAuthorInfo.name,
            authorPhoto: replyAuthorInfo.photo,
            formattedDate: formatDistanceToNow(replyCreated, {
              addSuffix: true,
              locale: dateFnsLocale,
            }),
            totalVotes: calculateTotalVotes(replyVoteCount),
            isAuthor: replyAuthorInfo.id === currentUserId,
            id: typeof replyObj.id === 'string' ? replyObj.id : '',
            text: typeof replyObj.text === 'string' ? replyObj.text : '',
          };

          formattedReplies.push(formattedReply);
        }
      });
    }

    // Construire le commentaire formaté avec uniquement les champs nécessaires
    const formattedComment: FormattedComment = {
      authorName: authorInfo.name,
      authorPhoto: authorInfo.photo,
      isAuthor: authorInfo.id === currentUserId,
      formattedDate,
      totalVotes,
      replies: formattedReplies,
      repliesCount: formattedReplies.length,
      id: serverData.id,
      text: typeof serverData.text === 'string' ? serverData.text : '',
    };

    return formattedComment;
  }, [commentItem, dateFnsLocale, currentUserId]);
}
