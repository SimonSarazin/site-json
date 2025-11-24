import { useState } from "react";
import { Calendar, Share2, Tag, ThumbsUp, MessageCircle, Trash2, Edit, Flag } from "lucide-react";
import { useT } from "@/hooks/useT";
import { formatDate } from "@/helpers/formatDate";
import { useCocolight } from "@/hooks/useCocolight";
import { useFormatNews } from "../../hooks/useFormatNews";
import { useReactiveProperty } from "@/hooks/useReactiveProperty";
import { useDeleteNews, useAddVoteNews } from "../../hooks/useNewsMutations";
import { NewsContent } from "./NewsContent";
import { NewsImageGrid } from "./NewsImageGrid";
import { NewsFileList } from "./NewsFileList";
import { NewsVoteDisplay } from "./NewsVoteDisplay";
import { NewsReactionPicker } from "./NewsReactionPicker";
import { NewsComments } from "./NewsComments";
import { DeleteNewsDialog } from "./DeleteNewsDialog";
import { EditNewsModal } from "./EditNewsModal";
import { ShareNewsDialog } from "./ShareNewsDialog";
import { ReportDialog } from "./ReportDialog";
import { voteTypes } from "./constants";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card";
import type { News, EntityTypes } from "@communecter/cocolight-api-client";

interface NewsItemProps {
  item: News;
  entity: EntityTypes;
  isLastItem?: boolean;
  lastItemRef?: (node: HTMLElement | null) => void;
}

export function NewsItem({ item, entity, isLastItem, lastItemRef }: NewsItemProps) {
  const t = useT("modules/profil");
  const { me } = useCocolight();

  const [openComments, setOpenComments] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);

  // Mutations pour gérer les actualités
  const deleteNewsMutation = useDeleteNews(entity, { optimistic: true });
  const addVoteNewsMutation = useAddVoteNews(entity, { optimistic: true });

  // Utilisation du hook de formatage pour simplifier l'accès aux données
  const formattedNews = useFormatNews(item);

  // S'abonner à commentCount pour détecter les changements via le système réactif
  const reactiveCommentCount = useReactiveProperty<number>(item.serverData, 'commentCount');

  // Si la news n'a pas pu être formatée, ne rien afficher
  if (!formattedNews) return null;

  const {
    authorName,
    authorPhoto,
    targetName,
    isSharedPost,
    isAuthor,
    hasImages,
    images,
    hasFiles,
    mediaFiles,
    tags,
    voteCount,
    userVoteType,
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
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    deleteNewsMutation.mutate(
      { news: item },
      {
        onSuccess: () => {
          setDeleteDialogOpen(false);
        },
      }
    );
  };

  const handleEditNews = () => {
    setEditModalOpen(true);
  };

  const handleReportNews = () => {
    setReportDialogOpen(true);
  };

  const handleReaction = (_newsId: string, reactionType: string) => {
    if (!me?.isConnected) {
      return;
    }

    addVoteNewsMutation.mutate({ news: item, voteType: reactionType });
  };

  const getUserReactionIcon = (userVoteType: string | null) => {
    if (!userVoteType) return null;
    const voteType = voteTypes.find(v => v.type === userVoteType);
    if (!voteType) return null;
    return {
      Icon: voteType.icon,
      color: voteType.color,
      type: voteType.type
    };
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
              <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-full bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center text-white font-bold text-base sm:text-lg md:text-xl shadow-md">
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
                {t(`NewsTab.${scope}`)}
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
                {isAuthor ? (
                  <>
                    <DropdownMenuItem onClick={handleEditNews}>
                      <Edit className="mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      <span className="text-xs sm:text-sm">{t("NewsTab.edit")}</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={handleDeleteNews}
                      className="text-red-600 focus:text-red-600"
                    >
                      <Trash2 className="mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      <span className="text-xs sm:text-sm">{t("NewsTab.delete")}</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleReportNews}>
                      <Flag className="mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      <span className="text-xs sm:text-sm">{t("NewsTab.report")}</span>
                    </DropdownMenuItem>
                  </>
                ) : (
                  <DropdownMenuItem onClick={handleReportNews}>
                    <Flag className="mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    <span className="text-xs sm:text-sm">{t("NewsTab.report")}</span>
                  </DropdownMenuItem>
                )}
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
                  className="inline-flex items-center gap-1 px-2 sm:px-3 py-1 sm:py-1.5 bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-400 rounded-full text-[10px] sm:text-xs font-medium border border-teal-200 dark:border-teal-700 hover:bg-teal-100 dark:hover:bg-teal-900/30 transition-colors cursor-pointer"
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
                    className="w-7 h-7 rounded-full bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center text-white text-xs font-bold border-2 border-background hover:scale-110 transition-transform cursor-pointer"
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
                {(() => {
                  const userReaction = getUserReactionIcon(userVoteType);
                  if (userReaction) {
                    const Icon = userReaction.Icon;
                    const colorClass = userReaction.color === 'red' ? 'text-red-500' :
                                     userReaction.color === 'blue' ? 'text-blue-500' :
                                     userReaction.color === 'green' ? 'text-green-500' :
                                     userReaction.color === 'teal' ? 'text-teal-500' :
                                     userReaction.color === 'yellow' ? 'text-yellow-500' :
                                     userReaction.color === 'purple' ? 'text-purple-500' :
                                     userReaction.color === 'indigo' ? 'text-indigo-500' :
                                     'text-gray-500';
                    return (
                      <>
                        <Icon className={`w-5 h-5 ${colorClass}`} />
                        <span className="hidden md:inline">{t(`NewsTab.reactionsTypes.${userReaction.type}`)}</span>
                      </>
                    );
                  }
                  return (
                    <>
                      <ThumbsUp className="w-5 h-5" />
                      <span className="hidden md:inline">{t("NewsTab.like")}</span>
                    </>
                  );
                })()}
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
            onClick={() => setShareDialogOpen(true)}
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
        <NewsComments news={item} entity={entity} />
      )}

      <DeleteNewsDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={confirmDelete}
        isPending={deleteNewsMutation.isPending}
      />

      <EditNewsModal
        entity={entity}
        news={item}
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
      />

      <ShareNewsDialog
        entity={entity}
        news={item}
        open={shareDialogOpen}
        onOpenChange={setShareDialogOpen}
      />

      <ReportDialog
        type="news"
        item={item}
        open={reportDialogOpen}
        onOpenChange={setReportDialogOpen}
      />
    </article>
  );
}
