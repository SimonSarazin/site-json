import "../i18n"; // side-effect : namespace i18n "modules/blog"
import { Plus } from "lucide-react";
import { Link } from "react-router";
import { useT } from "@/hooks/useT";
import { useHydrated } from "@/hooks/useHydrated";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { OptimizedImage } from "@/components/ui/OptimizedImage";
import { cn } from "@/lib/utils";
import { useArticleFeed } from "../hooks/useArticleFeed";
import { normalizeArticleResult, articleHref } from "../lib/articleLink";
import type { ArticleTeaserSectionProps } from "../schema";
import type { ArticleData } from "../hooks/useArticle";

const DEFAULT_LIMIT = 6;
const BASE = "/blog";
/** Même découpe asymétrique que la vignette de `FeaturedCarouselSlide` (carrousel « à la une »). */
const PHOTO_ROUNDING = "rounded-[0px_60px_0_60px]";

function TeaserSkeleton() {
  return (
    <div role="status" aria-busy="true" className="grid grid-cols-1 gap-x-10 gap-y-8 sm:grid-cols-2">
      <span className="sr-only">Chargement…</span>
      {Array.from({ length: DEFAULT_LIMIT }).map((_, i) => (
        <div key={i} className="relative flex items-start gap-4">
          <Skeleton className={cn("z-10 h-28 w-28 shrink-0", PHOTO_ROUNDING)} />
          <div className="flex-1 space-y-2 pt-1">
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-4 w-3/5" />
          </div>
          <Skeleton className="absolute bottom-2 left-24 z-0 h-7 w-24 rounded-full" />
        </div>
      ))}
    </div>
  );
}

interface TeaserCardProps {
  article: ArticleData;
  href: string;
  ctaLabel: string;
  accentColor?: string;
}

function TeaserCard({ article, href, ctaLabel, accentColor }: TeaserCardProps) {
  const image = article.profilMediumImageUrl || article.profilImageUrl;
  // Même couple fond fixe/texte blanc fixe que le CTA de `FeaturedCarouselSlide` (accentColor config-driven).
  const accentStyle = accentColor ? { backgroundColor: accentColor, color: "#fff" } : undefined;
  return (
    <Link
      to={href}
      className="group relative flex items-start gap-4 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <div className={cn("z-10 h-28 w-28 shrink-0 overflow-hidden bg-muted", PHOTO_ROUNDING)}>
        {image
          ? <OptimizedImage src={image} alt="" width={224} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
          : <div className="flex h-full w-full items-center justify-center text-muted-foreground/70">—</div>}
      </div>
      <div className="min-w-0 flex-1 pt-1">
        {/* Pas de couleur explicite : hérite du texte fixe (blanc) posé par la section — cf. le
            commentaire de `ArticleTeaser` plus bas. `text-foreground` s'inverserait en clair et
            deviendrait illisible sur le fond marine fixe. */}
        <h3 className="line-clamp-2 text-base font-bold leading-snug sm:text-lg">
          {article.name}
        </h3>
      </div>
      {/* Posé sur la photo (côté droit, chevauche son bord — sous elle, z-0 < z-10 de la photo). Le
          padding gauche (`pl-8`) fait démarrer le LABEL exactement au même niveau que le titre (`left-24`
          + `pl-8` = 8rem = position du texte, cf. gap-4 après la photo w-28). */}
      <span
        style={accentStyle}
        className={cn(
          "absolute bottom-2 left-24 z-0 inline-flex w-max items-center gap-1 rounded-full py-1.5 pr-4 pl-8 text-xs font-semibold shadow-md transition-opacity group-hover:opacity-90",
          !accentColor && "bg-primary text-primary-foreground",
        )}
      >
        {ctaLabel}
        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
    </Link>
  );
}

/** Contenu data-backed du teaser — monté APRÈS hydratation (île client, comme `articleFeed`). */
function Teaser({ props }: { props: ArticleTeaserSectionProps }) {
  const t = useT("modules/blog");
  const limit = props.limit ?? DEFAULT_LIMIT;
  const { transformedResults, isLoading, error, refetch } = useArticleFeed({
    costumSlug: props.costumSlug, pageSize: limit, filters: props.filters,
  });
  const items = ((transformedResults as unknown[]) ?? []).map(normalizeArticleResult).slice(0, limit);
  const ctaLabel = props.itemCtaLabel ? t(props.itemCtaLabel) : t("teaser.cta");

  if (isLoading) return <TeaserSkeleton />;
  if (error && !items.length) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center text-muted-foreground">
        <p>{t("feed.error")}</p>
        <Button variant="outline" onClick={() => refetch()}>{t("feed.retry")}</Button>
      </div>
    );
  }
  if (!items.length) {
    return <p className="py-10 text-center text-muted-foreground">{t("feed.empty")}</p>;
  }

  return (
    <div className="grid grid-cols-1 gap-x-10 gap-y-8 sm:grid-cols-2">
      {items.map((a, i) => (
        <TeaserCard key={a.id ?? i} article={a} href={articleHref(a, BASE)} ctaLabel={ctaLabel} accentColor={props.accentColor} />
      ))}
    </div>
  );
}

export default function ArticleTeaser({ id, props }: { id?: string; props: ArticleTeaserSectionProps }) {
  const t = useT("modules/blog");
  const hydrated = useHydrated();
  const { background, accentColor } = props;
  // Même patron que `FeaturedCarouselSection` : fond FIXE (config-driven) → texte blanc fixe, jamais
  // `text-foreground` (qui s'inverserait en mode clair/sombre). Sans `background`, repli sur le thème.
  const sectionStyle = background ? { backgroundColor: background } : undefined;
  const sectionClassName = background ? "text-white" : "bg-foreground text-background";
  const accentStyle = accentColor ? { backgroundColor: accentColor, color: "#fff" } : undefined;
  const viewAllHref = props.viewAllHref ?? BASE;
  const viewAllLabel = props.viewAllLabel ? t(props.viewAllLabel) : t("teaser.viewAll");

  return (
    <section id={id} style={sectionStyle} className={cn("py-16 px-4", sectionClassName)}>
      <div className="container mx-auto max-w-4xl">
        <h2 className="mb-10">
          <Badge
            variant={accentColor ? undefined : "secondary"}
            style={accentStyle}
            className="rounded-none border-none -rotate-4 px-4 py-1.5 shadow-md text-2xl md:text-3xl font-serif"
          >
            {t(props.headline)}
          </Badge>
        </h2>

        {hydrated ? <Teaser props={props} /> : <TeaserSkeleton />}

        <div className="mt-12 flex justify-center">
          <Button
            asChild
            variant="outline"
            style={accentColor ? { borderColor: accentColor, color: accentColor } : undefined}
            className={cn("rounded-full border-2 bg-transparent px-10 text-center", !accentColor && "border-current text-current")}
          >
            <Link to={viewAllHref}>
              {viewAllLabel}
              <Plus className="h-4 w-4 " aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
