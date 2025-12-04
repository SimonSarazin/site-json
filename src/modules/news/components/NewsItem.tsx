import { useState, useMemo } from "react";
import { Calendar, Share2, Tag, ThumbsUp, MessageCircle, Trash2, Edit, Flag, ExternalLink } from "lucide-react";
import { useT } from "@/hooks/useT";
import { formatDate } from "@/helpers/formatDate";
import { useCocolight } from "@/hooks/useCocolight";
import { useFormatNews } from "../hooks/useFormatNews";
import { useReactiveProperty } from "@/hooks/useReactiveProperty";
import { useAddVoteNews } from "../hooks/useNewsMutations";
import { NewsContent } from "./NewsContent";
import { NewsImageGrid } from "./media/NewsImageGrid";
import { NewsFileList } from "./media/NewsFileList";
import { NewsVoteDisplay } from "./interactions/NewsVoteDisplay";
import { NewsReactionPicker } from "./interactions/NewsReactionPicker";
import { NewsComments } from "./comment/NewsComments";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card";
import { Link } from "react-router";
import type { News, EntityTypes } from "@communecter/cocolight-api-client";
import { useNewsContext } from "../hooks/useNewsContext";

interface NewsItemProps {
  item: News;
  entity?: EntityTypes;
  isLastItem?: boolean;
  lastItemRef?: (node: HTMLElement | null) => void;
  onEdit?: (news: News) => void;
  onDelete?: (news: News) => void;
  onShare?: (news: News) => void;
  onReport?: (news: News) => void;
  detailMode?: boolean; // Si true, affichage en mode détail (pas de lien vers détail)
}

export function NewsItem({ item, entity, isLastItem, lastItemRef, onEdit, onDelete, onShare, onReport, detailMode = false }: NewsItemProps) {
  const t = useT("modules/news");
  const { me } = useCocolight();
  const newsContext = useNewsContext();
  const { entity: contextEntity } = newsContext;

  // Use entity from props or context
  const currentEntity = entity || contextEntity;

  // Générer l'URL vers la page de détail via le contexte
  const detailUrl = useMemo(() => {
    if (detailMode || !newsContext?.detailUrlGenerator || !item.id) return null;
    return newsContext.detailUrlGenerator(item.id);
  }, [detailMode, newsContext?.detailUrlGenerator, item.id]);

  const [openComments, setOpenComments] = useState(false);

  // Mutations pour gérer les actualités
  const addVoteNewsMutation = useAddVoteNews(currentEntity, { optimistic: true });

  // Utilisation du hook de formatage pour simplifier l'accès aux données
  const formattedNews = useFormatNews(item, currentEntity);

  // S'abonner à commentCount pour détecter les changements via le système réactif
  const reactiveCommentCount = useReactiveProperty<number>(item.serverData, 'commentCount');

  // Si la news n'a pas pu être formatée, ne rien afficher
  if (!formattedNews || !currentEntity) return null;

  const {
    authorName,
    authorPhoto,
    targetName,
    isSharedPost,
    canEdit,
    canDelete,
    hasImages,
    images,
    hasFiles,
    mediaFiles,
    tags,
    voteCount,
    hasVideo,
    videoEmbedUrl,
    sharedBy,
    sharedByCount,
    firstSharer,
    text,
    date,
    formattedDate,
    scope,
  } = formattedNews;
    
  const handleDeleteNews = () => {
    onDelete?.(item);
  };

  const handleEditNews = () => {
    onEdit?.(item);
  };

  const handleReportNews = () => {
    onReport?.(item);
  };

  const handleReaction = (_newsId: string, reactionType: string) => {
    if (!me?.isConnected) {
      return;
    }

    addVoteNewsMutation.mutate({ news: item, voteType: reactionType });
  };

  return (
    <article
      ref={isLastItem ? lastItemRef : undefined}
      className="bg-background rounded-xl border border-border shadow-sm hover:shadow-lg transition-all duration-300 overflow-visible"
    >
      <div className="p-4 sm:p-6 pb-3 sm:pb-4">
        <div className="flex items-start gap-2 sm:gap-4">
          <div className="shrink-0 cursor-pointer">
            {authorPhoto ? (
              <img
                src={authorPhoto}
                alt={authorName}
                className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-full object-cover border-2 border-border hover:scale-105 transition-transform cursor-pointer"
              />
            ) : (
              <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-full bg-gradient-to-br from-primary/80 to-primary flex items-center justify-center text-primary-foreground font-bold text-base sm:text-lg md:text-xl shadow-md">
                {authorName.charAt(0).toUpperCase()}
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
              <span className="text-sm sm:text-base md:text-lg font-bold text-foreground">
                {authorName}
              </span>

              {isSharedPost && targetName && (
                <>
                  <Share2 className="w-3 h-3 sm:w-4 sm:h-4 text-muted-foreground" />
                  <span className="text-xs sm:text-sm text-muted-foreground">
                    a partagé la publication de
                  </span>
                  <span className="text-xs sm:text-sm font-semibold text-foreground">
                    {targetName}
                  </span>
                </>
              )}
            </div>

            <div className="flex items-center gap-1 sm:gap-2 mt-1 text-xs sm:text-sm text-muted-foreground flex-wrap">
              <Calendar className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              <time dateTime={(date as Date)?.toISOString?.() || new Date().toISOString()}>
                {formatDate((date as Date) || new Date())}
              </time>
              <span className="inline-flex items-center px-1.5 sm:px-2 py-0.5 rounded text-[10px] sm:text-xs font-medium bg-lime-700 text-white dark:bg-lime-600">
                {t(`forms.scope.${scope}`)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-2">
            <span className="text-[10px] sm:text-xs text-muted-foreground hidden sm:block">
              {formattedDate}
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="p-1.5 sm:p-2 hover:bg-muted rounded-lg transition-colors">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                  </svg>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44 sm:w-48">
                {detailUrl && (
                  <DropdownMenuItem asChild>
                    <Link to={detailUrl}>
                      <ExternalLink className="mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      <span className="text-xs sm:text-sm">{t("NewsSection.viewDetails")}</span>
                    </Link>
                  </DropdownMenuItem>
                )}
                {canEdit && (
                  <DropdownMenuItem onClick={handleEditNews}>
                    <Edit className="mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    <span className="text-xs sm:text-sm">{t("NewsTab.edit")}</span>
                  </DropdownMenuItem>
                )}
                {canDelete && (
                  <DropdownMenuItem
                    onClick={handleDeleteNews}
                    className="text-red-600 focus:text-red-600"
                  >
                    <Trash2 className="mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    <span className="text-xs sm:text-sm">{t("NewsTab.delete")}</span>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={handleReportNews}>
                  <Flag className="mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span className="text-xs sm:text-sm">{t("NewsTab.report")}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      <NewsContent text={text as string} mentions={formattedNews.mentions} maxLength={300} />

      {hasVideo && videoEmbedUrl && (
        <div className="px-4 sm:px-6 pb-3 sm:pb-4">
          <div className="relative rounded-xl overflow-hidden bg-black aspect-video shadow-lg h-[150px] sm:h-[200px] md:h-[250px]">
            <iframe
              src={videoEmbedUrl}
              className="w-full h-full"
              allowFullScreen
              title="Vidéo embed"
            />
          </div>
        </div>
      )}

      {hasImages && <NewsImageGrid images={images} />}

      {hasFiles && <NewsFileList files={mediaFiles} />}

      {Array.isArray(tags) && tags.length > 0 && (
        <div className="px-4 sm:px-6 pb-3 sm:pb-4">
          <div className="flex flex-wrap gap-1.5 sm:gap-2">
            {tags.slice(0, 10).map((tag, tagIndex: number) => {
              const tagStr = typeof tag === 'string' ? tag : String(tag);
              return (
                <span
                  key={tagIndex}
                  className="inline-flex items-center gap-1 px-2 sm:px-3 py-1 sm:py-1.5 bg-primary/10 dark:bg-primary/20 text-primary dark:text-primary rounded-full text-[10px] sm:text-xs font-medium border border-primary/30 dark:border-primary/40 hover:bg-primary/20 dark:hover:bg-primary/30 transition-colors cursor-pointer"
                >
                  <Tag className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                  {tagStr.startsWith('#') ? tagStr : `#${tagStr}`}
                </span>
              );
            })}
            {tags.length > 10 && (
              <span className="inline-flex items-center px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs text-muted-foreground font-medium">
                +{tags.length - 10}
              </span>
            )}
          </div>
        </div>
      )}

      <NewsVoteDisplay voteCount={voteCount as Record<string, number>} newsId={item.id} />

      {sharedByCount > 0 && (
        <div className="px-6 pb-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Share2 className="w-4 h-4" />
            <div className="flex -space-x-2">
              {sharedBy.slice(0, 3).map((share, idx) => {
                return share.photo ? (
                  <img
                    key={idx}
                    src={share.photo}
                    alt={share.name}
                    title={share.name}
                    className="w-7 h-7 rounded-full border-2 border-background hover:scale-110 transition-transform cursor-pointer"
                  />
                ) : (
                  <div
                    key={idx}
                    title={share.name}
                    className="w-7 h-7 rounded-full bg-gradient-to-br from-primary/80 to-primary flex items-center justify-center text-primary-foreground text-xs font-bold border-2 border-background hover:scale-110 transition-transform cursor-pointer"
                  >
                    {share.name.charAt(0).toUpperCase()}
                  </div>
                );
              })}
            </div>
            <span>
              {t("NewsTab.sharedBy")} <strong>{firstSharer || t("NewsTab.someone")}</strong>
              {sharedByCount > 1 && ` ${sharedByCount > 2 ? t("NewsTab.andOthers_plural", undefined, { count: sharedByCount - 1 }) : t("NewsTab.andOthers", undefined, { count: sharedByCount - 1 })}`}
            </span>
          </div>
        </div>
      )}

      <div className="border-t border-border bg-muted/50">
        <div className="px-6 py-4 flex items-center justify-between text-base font-semibold">
          <button
            onClick={() => setOpenComments(!openComments)}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <MessageCircle className="w-5 h-5" />
            <span className="hidden md:inline">{t("NewsTab.comment")}</span>
            {typeof reactiveCommentCount === 'number' && reactiveCommentCount > 0 && (
              <span className="text-sm">({reactiveCommentCount})</span>
            )}
          </button>

          <HoverCard openDelay={200} closeDelay={100}>
            <HoverCardTrigger asChild>
              <button
                disabled={!me?.isConnected}
                className={`flex items-center gap-2 transition-colors ${
                  me?.isConnected
                    ? 'text-muted-foreground hover:text-blue-600 dark:hover:text-blue-400'
                    : 'text-muted-foreground/50 cursor-not-allowed'
                }`}
              >
                <ThumbsUp className="w-5 h-5" />
                <span className="hidden md:inline">{t("NewsTab.like")}</span>
              </button>
            </HoverCardTrigger>
            {me?.isConnected && (
              <HoverCardContent
                side="top"
                align="center"
                className="w-auto p-0 border-0 bg-transparent shadow-none"
              >
                <NewsReactionPicker onSelect={(type) => item.id && handleReaction(item.id, type)} />
              </HoverCardContent>
            )}
          </HoverCard>

          <button
            onClick={() => onShare?.(item)}
            disabled={!me?.isConnected}
            className={`flex items-center gap-2 transition-colors ${
              me?.isConnected
                ? 'text-muted-foreground hover:text-foreground'
                : 'text-muted-foreground/50 cursor-not-allowed'
            }`}
          >
            <Share2 className="w-5 h-5" />
            <span className="hidden md:inline">{t("NewsTab.share")}</span>
            {sharedByCount > 0 && (
              <span className="text-sm">({sharedByCount})</span>
            )}
          </button>
        </div>
      </div>

      {openComments && (
        <NewsComments news={item} entity={currentEntity} />
      )}
    </article>
  );
}