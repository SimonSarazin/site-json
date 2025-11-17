import { Calendar, Loader2, Share2, MessageCircle, Tag, ThumbsUp } from "lucide-react";
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

export function NewsTab() {
  const { entity, entityType } = useProfileEntity();
  useLoadNamespace("modules/profil");
  const t = useT("modules/profil");

  const { shouldLoad } = useLazyTab("news");
  const [showReactionPicker, setShowReactionPicker] = useState<string | null>(null);

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
    console.log(`Réaction ${reactionType} sur la news ${newsId}`);
    setShowReactionPicker(null);
  };

  if (!shouldLoad) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="bg-background p-8 rounded-lg border border-border shadow-sm">
        <div className="text-center py-16">
          <div className="animate-pulse space-y-4">
            <div className="h-12 w-12 bg-muted rounded-full mx-auto"></div>
            <div className="h-4 bg-muted rounded w-1/2 mx-auto"></div>
            <div className="h-3 bg-muted rounded w-1/3 mx-auto"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!news || news.length === 0) {
    return (
      <div className="bg-background p-8 rounded-lg border border-border shadow-sm">
        <div className="text-center py-16">
          <div className="text-muted-foreground mb-4">
            <Calendar className="w-16 h-16 mx-auto" />
          </div>
          <p className="text-xl font-semibold text-foreground mb-2">
            {t("NewsTab.noNews")}
          </p>
          <p className="text-muted-foreground">{t("NewsTab.noNewsDescription")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {news.map((item, index) => {
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
            <div className="p-6 pb-4">
              <div className="flex items-start gap-4">
                <div className="shrink-0 cursor-pointer">
                  {authorPhoto ? (
                    <img
                      src={authorPhoto}
                      alt={authorName}
                      className="w-14 h-14 rounded-full object-cover border-2 border-border hover:scale-105 transition-transform cursor-pointer"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-linear-to-br from-teal-400 to-teal-600 flex items-center justify-center text-white font-bold text-xl shadow-md">
                      {authorName.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-lg font-bold text-foreground">
                      {authorName}
                    </span>

                    {isSharedPost && targetName && (
                      <>
                        <Share2 className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          a partagé la publication de
                        </span>
                        <span className="text-sm font-semibold text-foreground">
                          {targetName}
                        </span>
                      </>
                    )}
                  </div>

                  <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                    <Calendar className="w-3.5 h-3.5" />
                    <time dateTime={item.serverData.date?.toISOString?.() || new Date().toISOString()}>
                      {formatDate(item.serverData.date || new Date())}
                    </time>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-lime-700 text-white dark:bg-lime-600">
                      {t("NewsTab.public")}
                    </span>
                  </div>
                </div>

                <button className="p-2 hover:bg-muted rounded-lg transition-colors">
                  <svg className="w-5 h-5 text-muted-foreground" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                  </svg>
                </button>
              </div>
            </div>

            <NewsContent text={item.serverData.text || ''} maxLength={300} />

            {hasVideo && videoEmbedUrl && (
              <div className="px-6 pb-4">
                <div className="relative rounded-xl overflow-hidden bg-black aspect-video shadow-lg h-[200px]">
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
              <div className="px-6 pb-4">
                <div className="flex flex-wrap gap-2">
                  {tags.slice(0, 10).map((tag: string, tagIndex: number) => (
                    <span
                      key={tagIndex}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-400 rounded-full text-xs font-medium border border-teal-200 dark:border-teal-700 hover:bg-teal-100 dark:hover:bg-teal-900/30 transition-colors cursor-pointer"
                    >
                      <Tag className="w-3 h-3" />
                      {tag.startsWith('#') ? tag : `#${tag}`}
                    </span>
                  ))}
                  {tags.length > 10 && (
                    <span className="inline-flex items-center px-3 py-1.5 text-xs text-muted-foreground font-medium">
                      +{tags.length - 10}
                    </span>
                  )}
                </div>
              </div>
            )}

            <NewsVoteDisplay voteCount={voteCount as Record<string, number>} />

            {sharedBy.length > 0 && (
              <div className="px-6 pb-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Share2 className="w-4 h-4" />
                  <div className="flex -space-x-2">
                    {sharedBy.slice(0, 3).map((share: any, idx: number) => {
                      const shareName = share.serverData?.name || share.data?.name || share.name || "Anonyme";
                      const sharePhoto = share.serverData?.profilThumbImageUrl || share.data?.profilThumbImageUrl;

                      return sharePhoto ? (
                        <img
                          key={idx}
                          src={sharePhoto}
                          alt={shareName}
                          title={shareName}
                          className="w-7 h-7 rounded-full border-2 border-background hover:scale-110 transition-transform cursor-pointer"
                        />
                      ) : (
                        <div
                          key={idx}
                          title={shareName}
                          className="w-7 h-7 rounded-full bg-linear-to-br from-teal-400 to-teal-600 flex items-center justify-center text-white text-xs font-bold border-2 border-background hover:scale-110 transition-transform cursor-pointer"
                        >
                          {shareName.charAt(0).toUpperCase()}
                        </div>
                      );
                    })}
                  </div>
                  <span>
                    {t("NewsTab.sharedBy")} <strong>{(sharedBy[0] as any)?.serverData?.name || (sharedBy[0] as any)?.data?.name || "quelqu'un"}</strong>
                    {sharedBy.length > 1 && ` ${sharedBy.length > 2 ? t("NewsTab.andOthers_plural", undefined, { count: sharedBy.length - 1 }) : t("NewsTab.andOthers", undefined, { count: sharedBy.length - 1 })}`}
                  </span>
                </div>
              </div>
            )}

            <footer className="px-6 py-4 border-t border-border bg-muted/50 rounded-b-xl">
              <div className="flex items-center justify-between text-base font-semibold">
                <button className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors px-4 py-2 rounded-lg hover:bg-muted">
                  <MessageCircle className="w-5 h-5" />
                  <span className="hidden md:inline">{t("NewsTab.comment")}</span>
                  {typeof commentCount === 'number' && commentCount > 0 && (
                    <span className="text-sm">({commentCount})</span>
                  )}
                </button>

                <div
                  className="relative"
                  onMouseEnter={() => item.id && setShowReactionPicker(item.id)}
                  onMouseLeave={() => setShowReactionPicker(null)}
                >
                  {showReactionPicker === item.id && (
                    <div
                      onMouseEnter={() => item.id && setShowReactionPicker(item.id)}
                      onMouseLeave={() => setShowReactionPicker(null)}
                    >
                      <NewsReactionPicker onSelect={(type) => item.id && handleReaction(item.id, type)} />
                    </div>
                  )}
                  <button className="flex items-center gap-2 text-muted-foreground hover:text-blue-600 dark:hover:text-blue-400 transition-colors px-4 py-2 rounded-lg hover:bg-muted">
                    <ThumbsUp className="w-5 h-5" />
                    <span className="hidden md:inline">{t("NewsTab.like")}</span>
                  </button>
                </div>

                <button className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors px-4 py-2 rounded-lg hover:bg-muted">
                  <Share2 className="w-5 h-5" />
                  <span className="hidden md:inline">{t("NewsTab.share")}</span>
                  {sharedBy.length > 0 && (
                    <span className="text-sm">({sharedBy.length})</span>
                  )}
                </button>
              </div>
            </footer>
          </article>
        );
      })}

      {isFetchingNextPage && (
        <div className="bg-background p-8 rounded-xl border border-border shadow-sm">
          <div className="text-center">
            <Loader2 className="w-10 h-10 animate-spin mx-auto text-teal-600" />
            <p className="text-sm text-muted-foreground mt-3 font-medium">
              {t("NewsTab.loadingNews")}
            </p>
          </div>
        </div>
      )}

      {!hasNextPage && news.length > 0 && (
        <div className="bg-background p-8 rounded-xl border border-border shadow-sm">
          <div className="text-center">
            <div className="w-12 h-12 bg-teal-100 dark:bg-teal-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
              <Calendar className="w-6 h-6 text-teal-600 dark:text-teal-400" />
            </div>
            <p className="text-foreground font-semibold mb-1">
              {t("NewsTab.upToDate")}
            </p>
            <p className="text-sm text-muted-foreground">
              {t("NewsTab.allNewsSeen")}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
