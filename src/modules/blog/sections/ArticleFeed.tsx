import "../i18n"; // side-effect : namespace i18n "modules/blog"
import { Loader2 } from "lucide-react";
import { useT } from "@/hooks/useT";
import { useHydrated } from "@/hooks/useHydrated";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useArticleFeed } from "../hooks/useArticleFeed";
import { ArticleCard } from "../components/ArticleCard";
import type { ArticleFeedSectionProps } from "../schema";
import type { ArticleData } from "../hooks/useArticle";

function norm(r: unknown): ArticleData {
  const sd = (r as { serverData?: Record<string, unknown> })?.serverData;
  const base = (sd && typeof sd === "object" ? sd : (r as Record<string, unknown>)) as ArticleData;
  // serverData.id n'est PAS toujours peuplé sur un résultat de recherche → repli sur l'id racine
  // (getter d'instance SDK), comme SearchListView/CardFunding/AdminResourceTable. Sinon href → /blog/id/undefined.
  if (base.id != null) return base;
  const rootId = (r as { id?: unknown })?.id;
  return rootId != null ? { ...base, id: String(rootId) } : base;
}
function hrefFor(a: ArticleData, base: string): string {
  return a.slug ? `${base}/${a.slug}` : `${base}/id/${a.id}`;
}

function FeedSkeleton() {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-72 w-full rounded-xl" />)}
    </div>
  );
}

/** Contenu data-backed du fil — monté APRÈS hydratation (île client, pas de fetch SSR). */
function Feed({ props, base }: { props: ArticleFeedSectionProps; base: string }) {
  const t = useT("modules/blog");
  const { transformedResults, lastItemRef, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage, error, refetch } = useArticleFeed({
    costumSlug: props.costumSlug, pageSize: props.pageSize, filters: props.filters,
  });
  const items = ((transformedResults as unknown[]) ?? []).map(norm);
  if (isLoading) return <FeedSkeleton />;
  // Erreur AVANT le test "vide" : une panne du search ne doit pas être déguisée en fil vide.
  if (error && !items.length) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center text-muted-foreground">
        <p>{t("feed.error")}</p>
        <Button variant="outline" onClick={() => refetch()}>{t("feed.retry")}</Button>
      </div>
    );
  }
  if (!items.length) return <p className="py-10 text-center text-muted-foreground">{t("feed.empty")}</p>;

  const featured = props.featured ? items[0] : undefined;
  const rest = props.featured ? items.slice(1) : items;
  return (
    <>
      {featured && <div className="mb-8"><ArticleCard article={featured} href={hrefFor(featured, base)} featured /></div>}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {rest.map((a, i) => (
          <ArticleCard key={a.id ?? i} article={a} href={hrefFor(a, base)} lastRef={i === rest.length - 1 ? (lastItemRef as never) : undefined} />
        ))}
      </div>
      {isFetchingNextPage && <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>}
      {hasNextPage && !isFetchingNextPage && (
        <div className="flex justify-center py-6"><Button variant="outline" onClick={() => fetchNextPage()}>{t("feed.loadMore")}</Button></div>
      )}
    </>
  );
}

export default function ArticleFeed({ id, props }: { id?: string; props: ArticleFeedSectionProps }) {
  const t = useT("modules/blog");
  const hydrated = useHydrated();
  // ⚠️ detailBasePath ≠ /blog n'est PAS encore câblé (routes figées /blog — backlog §11 items 3+4).
  // On force /blog pour ne pas générer de liens morts, et on signale la mauvaise config en dev.
  if (import.meta.env.DEV && props.detailBasePath && props.detailBasePath.replace(/\/$/, "") !== "/blog") {
    console.warn(`[blog] detailBasePath="${props.detailBasePath}" ignoré (routing multi-base non câblé) → /blog.`);
  }
  const base = "/blog";
  return (
    <section id={id} className="bg-background text-foreground">
      <div className="mx-auto w-full max-w-6xl px-4 py-8">
        {(props.title || props.description) && (
          <header className="mb-6 space-y-1">
            {props.title && <h2 className="text-2xl font-bold text-foreground">{t(props.title as never)}</h2>}
            {props.description && <p className="text-muted-foreground">{t(props.description as never)}</p>}
          </header>
        )}
        {hydrated ? <Feed props={props} base={base} /> : <FeedSkeleton />}
      </div>
    </section>
  );
}
