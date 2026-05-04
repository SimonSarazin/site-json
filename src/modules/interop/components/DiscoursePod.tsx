import { MessageSquare, Star, Diamond, Heart, ExternalLink, Unlink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useT } from "@/hooks/useT";
import { useInteropConfig } from "../hooks/useInteropConfigQuery";
import { useInteropUserLinks } from "../hooks/useUserInteropLinks";
import { useDiscourseProfilQuery } from "../hooks/useDiscourseProfil";
import { useDiscourseUnlink } from "../hooks/useInteropMutation";
import "../i18n";

/* ------------------------------------------------------------------ */
/* Types                                                                */
/* ------------------------------------------------------------------ */

interface DiscourseBadge {
  id: number;
  name: string;
  badge_type_id?: number;
}

interface DiscourseTopicItem {
  id: number;
  title: string;
  slug?: string;
  post_number?: number;
  like_count?: number;
  posts_count?: number;
}

interface DiscourseCategory {
  id: number;
  name: string;
  slug?: string;
  color?: string;
  topic_count?: number;
  post_count?: number;
  parent_category_id?: number;
}

interface DiscourseTopicRaw {
  id: number;
  title: string;
  slug: string;
  posts_count: number;
  like_count: number;
  category_id: number;
}

interface DiscourseReplyRaw {
  topic_id: number;
  like_count: number;
  post_number: number;
  created_at: string;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

function asBadges(v: unknown): DiscourseBadge[] {
  return Array.isArray(v) ? (v as DiscourseBadge[]) : [];
}

function asCategories(v: unknown): DiscourseCategory[] {
  return Array.isArray(v) ? (v as DiscourseCategory[]) : [];
}

function asUserSummary(v: unknown): Record<string, unknown> {
  return (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
}

/* ------------------------------------------------------------------ */
/* Sub-components                                                       */
/* ------------------------------------------------------------------ */

function ActivityStats({
  postCount,
  topicCount,
  likesReceived,
  t,
}: {
  postCount: number;
  topicCount: number;
  likesReceived: number;
  t: ReturnType<typeof useT>;
}) {
  return (
    <div>
      <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
        {t("discourse.activity")}
      </h3>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-muted/40 p-3">
          <p className="text-2xl font-bold text-foreground">{postCount.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{t("discourse.posts_created")}</p>
        </div>
        <div className="rounded-lg bg-muted/40 p-3">
          <p className="text-2xl font-bold text-foreground">{topicCount.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{t("discourse.topics_created")}</p>
        </div>
        <div className="rounded-lg bg-muted/40 p-3">
          <p className="text-2xl font-bold text-foreground">{likesReceived.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{t("discourse.likes_received")}</p>
        </div>
      </div>
    </div>
  );
}

function BadgesSection({
  badges,
  t,
}: {
  badges: DiscourseBadge[];
  t: ReturnType<typeof useT>;
}) {
  if (!badges.length) return null;
  return (
    <div>
      <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
        {t("discourse.badges")}
      </h3>
      <div className="flex flex-wrap gap-2">
        {badges.map((badge) => {
          const isGold = badge.badge_type_id === 1;
          const isSilver = badge.badge_type_id === 2;
          const showStar = isGold || isSilver;
          return (
            <span
              key={badge.id}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-foreground"
            >
              {showStar ? (
                <Star
                  className="h-3 w-3 shrink-0"
                  style={{ color: isGold ? "#f59e0b" : "#94a3b8" }}
                  fill="currentColor"
                />
              ) : (
                <Diamond className="h-3 w-3 shrink-0 text-primary" fill="currentColor" />
              )}
              {badge.name}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function TopList({
  title,
  items,
  icon,
  countKey,
  discourseUrl,
}: {
  title: string;
  items: DiscourseTopicItem[];
  icon: React.ReactNode;
  countKey: "like_count" | "posts_count";
  discourseUrl: string | null;
}) {
  if (!items.length) return null;

  const buildUrl = (item: DiscourseTopicItem) => {
    if (!discourseUrl || !item.slug) return undefined;
    const base = `${discourseUrl}/t/${item.slug}/${item.id}`;
    return item.post_number ? `${base}/${item.post_number}` : base;
  };

  return (
    <div className="flex-1 min-w-0">
      <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
        {title}
      </h3>
      <ul className="space-y-1">
        {items.slice(0, 5).map((item) => {
          const href = buildUrl(item);
          return (
            <li key={item.id}>
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start justify-between gap-2 rounded px-2 py-1.5 hover:bg-muted/40 text-sm group"
                {...(!href ? { role: "presentation", onClick: (e) => e.preventDefault() } : {})}
              >
                <span className="line-clamp-2 text-foreground group-hover:underline">{item.title}</span>
                <span className="flex items-center gap-1 shrink-0 text-muted-foreground text-xs font-medium whitespace-nowrap">
                  {icon}
                  {(item[countKey] ?? 0).toLocaleString()}
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function CategoriesSection({
  categories,
  discourseUrl,
  t,
}: {
  categories: DiscourseCategory[];
  discourseUrl: string | null;
  t: ReturnType<typeof useT>;
}) {
  if (!categories.length) return null;
  return (
    <div>
      <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
        {t("discourse.categories")}
      </h3>
      <div className="flex flex-wrap gap-2">
        {categories.map((cat) => {
          const href =
            discourseUrl && cat.slug
              ? `${discourseUrl}/c/${cat.slug}/${cat.id}`
              : undefined;
          return (
            <a
              key={cat.id}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs text-foreground hover:bg-muted/60 transition-colors"
              {...(!href ? { role: "presentation", onClick: (e) => e.preventDefault() } : {})}
            >
              {cat.color && (
                <span
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ backgroundColor: `#${cat.color}` }}
                />
              )}
              {cat.name}
            </a>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main component                                                       */
/* ------------------------------------------------------------------ */

export default function DiscoursePod() {
  const t = useT("modules/interop");
  const { discourseUrl } = useInteropConfig();
  const { discourseUsername, isOwnProfile } = useInteropUserLinks();
  const { data, isLoading } = useDiscourseProfilQuery();
  const unlinkMutation = useDiscourseUnlink();

  const summary = data?.summary ?? {};
  const userSummary = asUserSummary(summary.user_summary);

  // Badge definitions (name, type)
  const badges = asBadges(summary.badges);

  // TopReplies : user_summary.replies join avec summary.topics
  const rawTopics = Array.isArray(summary.topics) ? (summary.topics as DiscourseTopicRaw[]) : [];
  const rawReplies = Array.isArray(userSummary.replies) ? (userSummary.replies as DiscourseReplyRaw[]) : [];
  const topReplies: DiscourseTopicItem[] = rawReplies.map((reply) => {
    const topic = rawTopics.find((t) => t.id === reply.topic_id);
    return {
      id: reply.topic_id,
      title: topic?.title ?? `Topic #${reply.topic_id}`,
      slug: topic?.slug,
      post_number: reply.post_number,
      like_count: reply.like_count,
    };
  });

  // TopTopics : user_summary.topic_ids join avec summary.topics
  const topicIds = Array.isArray(userSummary.topic_ids) ? (userSummary.topic_ids as number[]) : [];
  const topTopics: DiscourseTopicItem[] = topicIds.map((id) => {
    const topic = rawTopics.find((t) => t.id === id);
    return {
      id,
      title: topic?.title ?? `Topic #${id}`,
      slug: topic?.slug,
      posts_count: topic?.posts_count,
      like_count: topic?.like_count,
    };
  });

  // Categories : user_summary.top_categories
  const categories = asCategories(
    Array.isArray(userSummary.top_categories) ? userSummary.top_categories : []
  );

  const postCount = Number(userSummary.post_count ?? 0);
  const topicCount = Number(userSummary.topic_count ?? 0);
  const likesReceived = Number(userSummary.likes_received ?? 0);

  const profileUrl =
    data?.profileUrl ??
    (discourseUrl && discourseUsername
      ? `${discourseUrl}/u/${discourseUsername}/summary`
      : undefined);

  return (
    <div className="rounded-lg overflow-hidden border border-border">
      {/* Header */}
      <div className="bg-primary text-primary-foreground px-4 py-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 shrink-0" />
          <span className="font-bold uppercase tracking-wide text-sm">
            {t("discourse.title")}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isOwnProfile && (
            <Button
              variant="outline"
              size="sm"
              className="text-primary-foreground border-primary-foreground/40 hover:bg-primary-foreground/10 hover:text-primary-foreground h-7 text-xs"
              onClick={() => unlinkMutation.mutate()}
              disabled={unlinkMutation.isPending}
          >
            <Unlink className="h-3 w-3 mr-1" />
            {t("discourse.unlink")}
          </Button>)}
          {profileUrl && (
            <a
              href={profileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs font-semibold text-primary-foreground hover:underline whitespace-nowrap"
            >
              {t("discourse.see_full_profile")}
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="bg-card p-4 space-y-5">
        {isLoading ? (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <Skeleton className="h-16 rounded-lg" />
              <Skeleton className="h-16 rounded-lg" />
              <Skeleton className="h-16 rounded-lg" />
            </div>
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-24" />
          </div>
        ) : (
          <>
            <ActivityStats
              postCount={postCount}
              topicCount={topicCount}
              likesReceived={likesReceived}
              t={t}
            />

            <BadgesSection badges={badges} t={t} />

            {(topReplies.length > 0 || topTopics.length > 0) && (
              <div className="flex gap-4">
                <TopList
                  title={t("discourse.top_replies")}
                  items={topReplies}
                  icon={<Heart className="h-3 w-3 text-destructive" />}
                  countKey="like_count"
                  discourseUrl={discourseUrl}
                />
                <TopList
                  title={t("discourse.top_topics")}
                  items={topTopics}
                  icon={<MessageSquare className="h-3 w-3 text-primary" />}
                  countKey="posts_count"
                  discourseUrl={discourseUrl}
                />
              </div>
            )}

            <CategoriesSection categories={categories} discourseUrl={discourseUrl} t={t} />
          </>
        )}
      </div>
    </div>
  );
}
