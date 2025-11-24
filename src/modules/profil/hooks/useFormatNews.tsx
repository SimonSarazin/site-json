import { useMemo } from "react";
import { formatDistanceToNow } from "date-fns";
import { useDateFnsLocale } from "@/hooks/useDateFnsLocale";
import { useCocolight } from "@/hooks/useCocolight";
import type { News, User, Organization } from "@communecter/cocolight-api-client";
import type { NewsMention } from "../components/news/NewsContent";

export interface SharedByPerson {
  name: string;
  photo: string | null;
}

/**
 * Interface pour une news formatée
 * Contient uniquement les champs calculés + les champs utilisés de NewsItemNormalized
 */
export interface FormattedNews {
  // Champs calculés pour l'auteur
  authorName: string;
  authorPhoto: string | null;
  isAuthor: boolean;

  // Target (pour les posts partagés)
  targetId: string | null;
  targetName: string | null;
  isSharedPost: boolean;

  // Date formatée
  formattedDate: string;

  // SharedBy formaté
  sharedBy: SharedByPerson[];
  sharedByCount: number;
  firstSharer: string | null;

  // Médias formatés
  hasImages: boolean;
  images: string[];
  hasFiles: boolean;
  mediaFiles: unknown[];
  hasVideo: boolean;
  videoEmbedUrl: string | null;

  // Votes calculés
  totalVotes: number;
  userVoteType: string | null;

  // Scope
  scope: string;

  // Mentions
  mentions?: NewsMention[];

  // Champs de NewsItemNormalized qu'on utilise
  tags?: unknown[];
  commentCount?: number;
  voteCount?: Record<string, number>;
  text?: unknown;
  date?: Date;
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

  // Si c'est un objet brut
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

function getUserVoteType(
  serverData: Record<string, unknown>,
  userId: string | undefined
): string | null {
  if (!userId) return null;

  const vote = serverData.vote as Record<string, Record<string, unknown>> | undefined;
  if (vote && typeof vote === "object") {
    if (userId in vote) {
      const userVote = vote[userId];
      if (userVote && typeof userVote === "object" && "status" in userVote) {
        return userVote.status as string;
      }
    }
  }

  return null;
}

/**
 * Hook pour formater les données d'une news
 * Extrait et simplifie l'accès aux données complexes du News
 */
export function useFormatNews(newsItem: News | null): FormattedNews | null {
  const dateFnsLocale = useDateFnsLocale();
  const { me } = useCocolight();

  const currentUserId = me?.serverData?.id;

  return useMemo(() => {
    if (!newsItem || !newsItem.serverData) return null;

    const { serverData } = newsItem;

    // Extraction des infos de l'auteur
    const authorInfo = extractAuthorInfo(serverData.author);

    // Extraction des infos du target (pour les posts partagés)
    const targetInfo = serverData.target
      ? extractAuthorInfo(serverData.target)
      : { id: null, name: null, photo: null };

    // Déterminer si c'est un post partagé
    const isSharedPost = !!(targetInfo.id && targetInfo.id !== authorInfo.id);

    // Gestion du created qui doit être une Date
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

    // SharedBy - Formater les personnes qui ont partagé
    const rawSharedBy = Array.isArray(serverData.sharedBy) ? serverData.sharedBy : [];
    const sharedBy: SharedByPerson[] = rawSharedBy.map((share) => {
      const shareInfo = extractAuthorInfo(share);
      return {
        name: shareInfo.name,
        photo: shareInfo.photo,
      };
    });
    const firstSharer = sharedBy.length > 0 ? sharedBy[0].name : null;

    // Médias - Images
    const images = serverData.mediaImg?.images || [];
    const hasImages = Array.isArray(images) && images.length > 0;

    // Médias - Fichiers/Documents
    const mediaFiles = serverData.mediaFile?.files || [];
    const hasFiles = Array.isArray(mediaFiles) && mediaFiles.length > 0;

    // Médias - Vidéo
    const media = serverData.media && typeof serverData.media === 'object'
      ? serverData.media as Record<string, unknown>
      : null;
    const mediaContent = media?.content && typeof media.content === 'object'
      ? media.content as Record<string, unknown>
      : null;
    const hasVideo = mediaContent?.type === 'video_link';
    const videoEmbedUrl = hasVideo && typeof mediaContent?.videoLink === 'string'
      ? mediaContent.videoLink
      : null;

    // Votes
    const voteCount = serverData.voteCount && typeof serverData.voteCount === 'object'
      ? serverData.voteCount as Record<string, number>
      : {};
    const totalVotes = calculateTotalVotes(voteCount);

    const userVoteType = getUserVoteType(serverData as Record<string, unknown>, currentUserId);

    // Scope (public, private, restricted)
    const scope = serverData.scope && typeof serverData.scope === 'object'
      ? (serverData.scope as Record<string, unknown>).type as string || 'public'
      : 'public';

    // Mentions
    const mentions = Array.isArray(serverData.mentions) ? serverData.mentions as NewsMention[] : undefined;

    // Construire la news formatée avec uniquement les champs nécessaires
    const formattedNews: FormattedNews = {
      authorName: authorInfo.name,
      authorPhoto: authorInfo.photo,
      isAuthor: authorInfo.id === currentUserId,
      targetId: targetInfo.id,
      targetName: targetInfo.name,
      isSharedPost,
      formattedDate,
      sharedBy,
      sharedByCount: sharedBy.length,
      firstSharer,
      hasImages,
      images: images as string[],
      hasFiles,
      mediaFiles,
      hasVideo,
      videoEmbedUrl,
      totalVotes,
      userVoteType,
      scope,
      mentions,
      tags: Array.isArray(serverData.tags) ? serverData.tags : undefined,
      commentCount: typeof serverData.commentCount === 'number' ? serverData.commentCount : undefined,
      voteCount,
      text: serverData.text,
      date: serverData.date instanceof Date ? serverData.date : undefined,
    };

    return formattedNews;
  }, [newsItem, dateFnsLocale, currentUserId]);
}
