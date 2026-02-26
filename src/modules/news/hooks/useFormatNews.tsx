import { useMemo } from "react";
import { formatDistanceToNow } from "date-fns";
import { useDateFnsLocale } from "@/hooks/useDateFnsLocale";
import { useCocolight } from "@/hooks/useCocolight";
import type { News, EntityTypes, NewsMention } from "@communecter/cocolight-api-client";
import { useNewsPermissions } from "./useNewsPermissions";
import { extractAuthorInfo, calculateTotalVotes } from "@/lib/entityFormatting";
import type { NewsImageItem, NewsDocumentItem } from "../types";

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
  images: NewsImageItem[];
  hasFiles: boolean;
  mediaFiles: NewsDocumentItem[];
  hasVideo: boolean;
  videoEmbedUrl: string | null;

  // Votes calculés
  totalVotes: number;

  // Scope
  scope: string;

  // Mentions
  mentions?: NewsMention[];

  // Permissions
  canEdit: boolean;
  canDelete: boolean;

  // Champs de NewsItemNormalized qu'on utilise
  tags?: unknown[];
  commentCount?: number;
  voteCount?: Record<string, number>;
  text?: unknown;
  date?: Date;
}

/**
 * Hook pour formater les données d'une news
 * Extrait et simplifie l'accès aux données complexes du News
 * @param newsItem - La news à formater
 * @param entity - L'entité propriétaire (pour calculer les permissions)
 */
export function useFormatNews(newsItem: News | null, entity: EntityTypes | null = null): FormattedNews | null {
  const dateFnsLocale = useDateFnsLocale();
  const { me } = useCocolight();
  const permissions = useNewsPermissions(entity, newsItem);

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
    const images = (serverData.mediaImg?.images || []) as NewsImageItem[];
    const hasImages = Array.isArray(images) && images.length > 0;

    // Médias - Fichiers/Documents
    const mediaFiles = (serverData.mediaFile?.files || []) as NewsDocumentItem[];
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
      images,
      hasFiles,
      mediaFiles,
      hasVideo,
      videoEmbedUrl,
      totalVotes,
      scope,
      mentions,
      canEdit: permissions.canEditNews,
      canDelete: permissions.canDeleteNews,
      tags: Array.isArray(serverData.tags) ? serverData.tags : undefined,
      commentCount: typeof serverData.commentCount === 'number' ? serverData.commentCount : undefined,
      voteCount,
      text: serverData.text,
      date: serverData.date instanceof Date ? serverData.date : undefined,
    };

    return formattedNews;
  }, [newsItem, dateFnsLocale, currentUserId, permissions]);
}