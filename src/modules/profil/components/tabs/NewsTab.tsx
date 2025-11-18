import { Calendar, Loader2, Share2, Tag, ThumbsUp, MessageCircle, Trash2, Edit, Flag } from "lucide-react";
import { useProfileEntity } from "../../hooks/useProfileEntity";
import { useLazyTab } from "@/hooks/useLazyTab";
import { useProfilNewsQuery } from "../../hooks/useProfilNewsQuery";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { formatDate } from "@/helpers/formatDate";
import { useState } from "react";
import "@/modules/profil/i18n";
import { NewsContent } from "../news/NewsContent";
import { NewsImageGrid } from "../news/NewsImageGrid";
import { NewsVoteDisplay } from "../news/NewsVoteDisplay";
import { NewsReactionPicker } from "../news/NewsReactionPicker";
import { NewsComments } from "../news/NewsComments";
import { AddNewsModal } from "../news/AddNewsModal";
import { formatDistanceToNow } from "date-fns";
import { fr, enUS } from "date-fns/locale";
import { useLocalization } from "@/hooks/useLocalization";
import { useCocolight } from "@/hooks/useCocolight";
import { useDeleteNews } from "../../hooks/useDeleteNews";
// import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function NewsTab() {
  const { entity, entityType } = useProfileEntity();
  useLoadNamespace("modules/profil");
  const t = useT("modules/profil");
  const { currentLocale } = useLocalization();
  const { me } = useCocolight();

  const { shouldLoad } = useLazyTab("news");
  const [showReactionPicker, setShowReactionPicker] = useState<string | null>(null);
  const [openComments, setOpenComments] = useState<Record<string, boolean>>({});
  const [showAddNewsModal, setShowAddNewsModal] = useState(false);
  const [newsToDelete, setNewsToDelete] = useState<string | null>(null);

  const { deleteNewsAsync, isDeletingNews } = useDeleteNews();

  const handleDeleteNews = async () => {
    if (!newsToDelete) return;

    try {
      await deleteNewsAsync({ newsId: newsToDelete });
      setNewsToDelete(null);
    } catch (error) {
      console.error("Erreur lors de la suppression:", error);
      alert("Une erreur est survenue lors de la suppression");
    }
  };

  const handleEditNews = (newsId: string) => {
    console.log("Edit news:", newsId);
    // TODO: Implémenter l'édition
  };

  const handleReportNews = (newsId: string) => {
    console.log("Report news:", newsId);
    // TODO: Implémenter le signalement
  };

  const {
    news,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    lastItemRef,
  } = useProfilNewsQuery({
    entity,
    entityType,
    enabled: shouldLoad,
    indexStep: 12,
  });

  const handleReaction = (newsId: string, reactionType: string) => {
    if (!me?.isConnected) {
      console.warn("User must be logged in to react");
      return;
    } else {
      console.log("ato");
    }
    setShowReactionPicker(null);
  };

  if (!shouldLoad) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="bg-background p-6 sm:p-8 rounded-lg border border-border shadow-sm">
        <div className="text-center py-12 sm:py-16">
          <div className="animate-pulse space-y-3 sm:space-y-4">
            <div className="h-10 w-10 sm:h-12 sm:w-12 bg-muted rounded-full mx-auto"></div>
            <div className="h-3 sm:h-4 bg-muted rounded w-1/2 mx-auto"></div>
            <div className="h-2 sm:h-3 bg-muted rounded w-1/3 mx-auto"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!news || news.length === 0) {
    return (
      <div className="bg-background p-6 sm:p-8 rounded-lg border border-border shadow-sm">
        <div className="text-center py-12 sm:py-16">
          <div className="text-muted-foreground mb-3 sm:mb-4">
            <Calendar className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 mx-auto" />
          </div>
          <p className="text-lg sm:text-xl font-semibold text-foreground mb-1 sm:mb-2 px-4">
            {t("NewsTab.noNews")}
          </p>
          <p className="text-sm sm:text-base text-muted-foreground px-4">{t("NewsTab.noNewsDescription")}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4 sm:space-y-6">
        {/* {me?.isConnected && (
          <div className="flex justify-end">
            <Button
              onClick={() => setShowAddNewsModal(true)}
              className="bg-[#0092a2] hover:bg-teal-600 text-xs sm:text-sm"
            >
              <Plus className="w-4 h-4 mr-2" />
              {t("NewsTab.createPost")}
            </Button>
          </div>
        )} */}

        {news.filter(Boolean).map((item, index) => {
          const isLastItem = index === news.length - 1;

          const author = item.serverData.author;
          const target = item.serverData.target;
          const sharedBy = item.serverData.sharedBy || [];
          const hasImages = item.serverData.mediaImg?.images?.length > 0;
          const images = item.serverData.mediaImg?.images || [];
          const tags = item.serverData.tags || [];
          const commentCount = item.serverData.commentCount || 0;
          const voteCount = item.serverData.voteCount || {};
          const media = item.serverData.media;

          const authorName = (author?.serverData as any)?.name || (author?.data as any)?.name || "Anonyme";
          const authorPhoto = (author?.serverData as any)?.profilThumbImageUrl || (author?.data as any)?.profilThumbImageUrl || null;
          const targetName = (target?.serverData as any)?.name || (target?.data as any)?.name;
          const targetId = (target?.serverData as any)?.id || (target?.data as any)?.id;
          const authorId = (author?.serverData as any)?.id || (author?.data as any)?.id;
          const isSharedPost = target && targetId !== authorId;

          const hasVideo = (media as any)?.content?.type === 'video_link';
          const videoEmbedUrl = (media as any)?.content?.videoLink;

          return (
            <article
              key={item.id}
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
                      <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-full bg-linear-to-br from-teal-400 to-teal-600 flex items-center justify-center text-white font-bold text-base sm:text-lg md:text-xl shadow-md">
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
                      <time dateTime={item.serverData.date?.toISOString?.() || new Date().toISOString()}>
                        {formatDate(item.serverData.date || new Date())}
                      </time>
                      <span className="inline-flex items-center px-1.5 sm:px-2 py-0.5 rounded text-[10px] sm:text-xs font-medium bg-lime-700 text-white dark:bg-lime-600">
                        {t("NewsTab.public")}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 sm:gap-2">
                    <span className="text-[10px] sm:text-xs text-muted-foreground hidden sm:block">
                      {formatDistanceToNow(item.serverData.date || new Date(), {
                        addSuffix: true,
                        locale: currentLocale === "fr" ? fr : enUS
                      })}
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
                        {me?.isConnected && authorId === me?.serverData?.id ? (
                          <>
                            <DropdownMenuItem onClick={() => handleEditNews(item.id || '')}>
                              <Edit className="mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
                              <span className="text-xs sm:text-sm">{t("NewsTab.edit") || "Modifier"}</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setNewsToDelete(item.id || '')}
                              className="text-red-600 focus:text-red-600"
                            >
                              <Trash2 className="mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
                              <span className="text-xs sm:text-sm">{t("NewsTab.delete") || "Supprimer"}</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleReportNews(item.id || '')}>
                              <Flag className="mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
                              <span className="text-xs sm:text-sm">{t("NewsTab.report") || "Signaler un abus"}</span>
                            </DropdownMenuItem>
                          </>
                        ) : (
                          <DropdownMenuItem onClick={() => handleReportNews(item.id || '')}>
                            <Flag className="mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
                            <span className="text-xs sm:text-sm">{t("NewsTab.report") || "Signaler un abus"}</span>
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>

              <NewsContent text={item.serverData.text || ''} maxLength={300} />

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

              {Array.isArray(tags) && tags.length > 0 && (
                <div className="px-4 sm:px-6 pb-3 sm:pb-4">
                  <div className="flex flex-wrap gap-1.5 sm:gap-2">
                    {tags.slice(0, 10).map((tag: string, tagIndex: number) => (
                      <span
                        key={tagIndex}
                        className="inline-flex items-center gap-1 px-2 sm:px-3 py-1 sm:py-1.5 bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-400 rounded-full text-[10px] sm:text-xs font-medium border border-teal-200 dark:border-teal-700 hover:bg-teal-100 dark:hover:bg-teal-900/30 transition-colors cursor-pointer"
                      >
                        <Tag className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                        {tag.startsWith('#') ? tag : `#${tag}`}
                      </span>
                    ))}
                    {tags.length > 10 && (
                      <span className="inline-flex items-center px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs text-muted-foreground font-medium">
                        +{tags.length - 10}
                      </span>
                    )}
                  </div>
                </div>
              )}

              <NewsVoteDisplay voteCount={voteCount as Record<string, number>} newsId={item.id} />

              {sharedBy.length > 0 && (
                <div className="px-4 sm:px-6 pb-2 sm:pb-3">
                  <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-muted-foreground">
                    <Share2 className="w-3 h-3 sm:w-4 sm:h-4 shrink-0" />
                    <div className="flex -space-x-1.5 sm:-space-x-2">
                      {sharedBy.slice(0, 3).map((share: any, idx: number) => {
                        const shareName = share.serverData?.name || share.data?.name || share.name || "Anonyme";
                        const sharePhoto = share.serverData?.profilThumbImageUrl || share.data?.profilThumbImageUrl;

                        return sharePhoto ? (
                          <img
                            key={idx}
                            src={sharePhoto}
                            alt={shareName}
                            title={shareName}
                            className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 rounded-full border-2 border-background hover:scale-110 transition-transform cursor-pointer"
                          />
                        ) : (
                          <div
                            key={idx}
                            title={shareName}
                            className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 rounded-full bg-linear-to-br from-teal-400 to-teal-600 flex items-center justify-center text-white text-[10px] sm:text-xs font-bold border-2 border-background hover:scale-110 transition-transform cursor-pointer"
                          >
                            {shareName.charAt(0).toUpperCase()}
                          </div>
                        );
                      })}
                    </div>
                    <span className="text-[10px] sm:text-xs md:text-sm">
                      {t("NewsTab.sharedBy")} <strong>{(sharedBy[0] as any)?.serverData?.name || (sharedBy[0] as any)?.data?.name || "quelqu'un"}</strong>
                      {sharedBy.length > 1 && ` ${sharedBy.length > 2 ? t("NewsTab.andOthers_plural", undefined, { count: sharedBy.length - 1 }) : t("NewsTab.andOthers", undefined, { count: sharedBy.length - 1 })}`}
                    </span>
                  </div>
                </div>
              )}

              <div className="border-t border-border bg-muted/50">
                <div className="px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between text-sm sm:text-base font-semibold">
                  <button
                    onClick={() => {
                      const currentOpen = openComments[item.id || ''];
                      setOpenComments({ ...openComments, [item.id || '']: !currentOpen });
                    }}
                    className="flex items-center gap-1 sm:gap-2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                    <span className="hidden sm:inline">{t("NewsTab.comment")}</span>
                    {typeof commentCount === 'number' && commentCount > 0 && (
                      <span className="text-xs sm:text-sm">({commentCount})</span>
                    )}
                  </button>

                  <div
                    className="relative"
                    onMouseEnter={() => me?.isConnected && item.id && setShowReactionPicker(item.id)}
                    onMouseLeave={() => setShowReactionPicker(null)}
                  >
                    {showReactionPicker === item.id && me?.isConnected && (
                      <div
                        onMouseEnter={() => item.id && setShowReactionPicker(item.id)}
                        onMouseLeave={() => setShowReactionPicker(null)}
                      >
                        <NewsReactionPicker onSelect={(type) => item.id && handleReaction(item.id, type)} />
                      </div>
                    )}
                    <button
                      disabled={!me?.isConnected}
                      className={`flex items-center gap-1 sm:gap-2 transition-colors ${me?.isConnected
                        ? 'text-muted-foreground hover:text-blue-600 dark:hover:text-blue-400'
                        : 'text-muted-foreground/50 cursor-not-allowed'
                        }`}
                    >
                      <ThumbsUp className="w-4 h-4 sm:w-5 sm:h-5" />
                      <span className="hidden sm:inline">{t("NewsTab.like")}</span>
                    </button>
                  </div>

                  <button className="flex items-center gap-1 sm:gap-2 text-muted-foreground hover:text-foreground transition-colors">
                    <Share2 className="w-4 h-4 sm:w-5 sm:h-5" />
                    <span className="hidden sm:inline">{t("NewsTab.share")}</span>
                    {sharedBy.length > 0 && (
                      <span className="text-xs sm:text-sm">({sharedBy.length})</span>
                    )}
                  </button>
                </div>
              </div>

              {openComments[item.id || ''] && (
                <NewsComments newsId={item.id} />
              )}
            </article>
          );
        })}

        {isFetchingNextPage && (
          <div className="bg-background p-6 sm:p-8 rounded-xl border border-border shadow-sm">
            <div className="text-center">
              <Loader2 className="w-8 h-8 sm:w-10 sm:h-10 animate-spin mx-auto text-teal-600" />
              <p className="text-xs sm:text-sm text-muted-foreground mt-2 sm:mt-3 font-medium">
                {t("NewsTab.loadingNews")}
              </p>
            </div>
          </div>
        )}

        {!hasNextPage && news.length > 0 && (
          <div className="bg-background p-6 sm:p-8 rounded-xl border border-border shadow-sm">
            <div className="text-center">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-teal-100 dark:bg-teal-900/30 rounded-full flex items-center justify-center mx-auto mb-2 sm:mb-3">
                <Calendar className="w-5 h-5 sm:w-6 sm:h-6 text-teal-600 dark:text-teal-400" />
              </div>
              <p className="text-sm sm:text-base text-foreground font-semibold mb-1">
                {t("NewsTab.upToDate")}
              </p>
              <p className="text-xs sm:text-sm text-muted-foreground">
                {t("NewsTab.allNewsSeen")}
              </p>
            </div>
          </div>
        )}
      </div>

      {
        showAddNewsModal &&
        <AddNewsModal
          open={showAddNewsModal}
          onOpenChange={setShowAddNewsModal}
        />
      }
      <AlertDialog open={!!newsToDelete} onOpenChange={(open) => !open && setNewsToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base sm:text-lg">
              {t("NewsTab.deleteConfirm.title")}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm sm:text-base">
              {t("NewsTab.deleteConfirm.description")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingNews} className="text-xs sm:text-sm">
              {t("NewsTab.deleteConfirm.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteNews}
              disabled={isDeletingNews}
              className="bg-red-600 hover:bg-red-700 text-xs sm:text-sm"
            >
              {isDeletingNews ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t("NewsTab.deleteConfirm.deleting")}
                </>
              ) : (
                t("NewsTab.deleteConfirm.confirm")
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
