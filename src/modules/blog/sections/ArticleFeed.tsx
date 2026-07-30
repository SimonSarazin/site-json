import "../i18n"; // side-effect : namespace i18n "modules/blog"
import { Suspense, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useT } from "@/hooks/useT";
import { useHydrated } from "@/hooks/useHydrated";
import { useSite } from "@/hooks/useSite";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useArticleFeed } from "../hooks/useArticleFeed";
import { CARD_VARIANTS } from "../variants/cards";
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
  if (a.slug) return `${base}/${a.slug}`;
  if (a.id) return `${base}/id/${a.id}`;
  return base; // ni slug ni id (article mal formé) → la liste, jamais `/blog/id/undefined`
}

function FeedSkeleton() {
  return (
    <div role="status" aria-busy="true" className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      <span className="sr-only">Chargement…</span>
      {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-72 w-full rounded-xl" />)}
    </div>
  );
}

/** Contenu data-backed du fil — monté APRÈS hydratation (île client, pas de fetch SSR). */
function Feed({ props, base, cardVariant, feedLayout }: {
  props: ArticleFeedSectionProps;
  base: string;
  cardVariant?: string;
  feedLayout: "grid" | "list";
}) {
  const t = useT("modules/blog");
  const { transformedResults, lastItemRef, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage, error, refetch } = useArticleFeed({
    costumSlug: props.costumSlug, pageSize: props.pageSize, filters: props.filters,
  });
  const items = ((transformedResults as unknown[]) ?? []).map(norm);
  // Variant de carte (lazy, registre CARD_VARIANTS) — un variant inconnu retombe sur `default`.
  const Card = CARD_VARIANTS.get(cardVariant);

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
  const containerCls =
    feedLayout === "list"
      ? "flex flex-col gap-4"
      : `grid gap-6 sm:grid-cols-2 lg:grid-cols-3${props.fullWidth ? " xl:grid-cols-4" : ""}`;
  return (
    // Suspense : le chunk de la carte (lazy) est chargé (préchargé en amont via `preload`, cf. section).
    <Suspense fallback={<FeedSkeleton />}>
      {/* eslint-disable-next-line react-hooks/static-components -- `Card` vient d'un
          REGISTRE, il n'est pas fabriqué ici : `makeVariantRegistry` referme un objet
          construit au chargement du module et `get()` n'est qu'un `variants[key] ?? default`.
          La même référence est donc renvoyée à chaque rendu — aucun état n'est remis à zéro.
          Le type ne change que si le variant change, ce qui est le comportement voulu. */}
      {featured && <div className="mb-8"><Card article={featured} href={hrefFor(featured, base)} featured /></div>}
      <div className={containerCls}>
        {rest.map((a, i) => (
          <Card key={a.id ?? i} article={a} href={hrefFor(a, base)} lastRef={i === rest.length - 1 ? (lastItemRef as never) : undefined} />
        ))}
      </div>
      {isFetchingNextPage && <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>}
      {hasNextPage && !isFetchingNextPage && (
        <div className="flex justify-center py-6"><Button variant="outline" onClick={() => fetchNextPage()}>{t("feed.loadMore")}</Button></div>
      )}
    </Suspense>
  );
}

export default function ArticleFeed({ id, props }: { id?: string; props: ArticleFeedSectionProps }) {
  const t = useT("modules/blog");
  const hydrated = useHydrated();
  const { config } = useSite();
  const blogCfg = config.blog;
  // Résolution des variants : props de section > défauts config.blog > défaut du registre/enum.
  const cardVariant = props.cardVariant ?? blogCfg?.defaultCardVariant;
  const feedLayout = (props.feedLayout ?? blogCfg?.defaultFeedLayout ?? "grid") as "grid" | "list";
  // vite-preload : chauffe le chunk de la carte tôt (client) → pas de flash Suspense après le fetch.
  useEffect(() => { CARD_VARIANTS.preload(cardVariant); }, [cardVariant]);

  // ⚠️ detailBasePath déprécié : reader canonique unique /blog (cf. schema/items 2+3). On force /blog.
  if (import.meta.env.DEV && props.detailBasePath && props.detailBasePath.replace(/\/$/, "") !== "/blog") {
    console.warn(`[blog] detailBasePath="${props.detailBasePath}" ignoré (reader canonique unique) → /blog.`);
  }
  const base = "/blog";
  return (
    <section id={id} className="bg-background text-foreground">
      <div className={`mx-auto w-full px-4 py-8 ${props.fullWidth ? "max-w-[1536px]" : "max-w-6xl"}`}>
        {(props.title || props.description) && (
          <header className="mb-6 space-y-1">
            {props.title && <h2 className="text-2xl font-bold text-foreground">{t(props.title as never)}</h2>}
            {props.description && <p className="text-muted-foreground">{t(props.description as never)}</p>}
          </header>
        )}
        {hydrated ? <Feed props={props} base={base} cardVariant={cardVariant} feedLayout={feedLayout} /> : <FeedSkeleton />}
      </div>
    </section>
  );
}
