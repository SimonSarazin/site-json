import "../i18n"; // side-effect : namespace i18n "modules/blog"
import { Suspense, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useT } from "@/hooks/useT";
import { useHydrated } from "@/hooks/useHydrated";
import { useSite } from "@/hooks/useSite";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useArticleFeed, usePinnedArticle } from "../hooks/useArticleFeed";
import { CARD_VARIANTS } from "../variants/cards";
import { normalizeArticleResult, articleHref } from "../lib/articleLink";
import { pickFeatured } from "../lib/pickFeatured";
import type { ArticleFeedSectionProps } from "../schema";

/** `compact` : squelette plus court et à 2 colonnes DÈS le mobile, à la hauteur de la carte resserrée
 *  (`density: "compact"`) — sinon le chargement montrerait un gabarit plus grand/plus large que le
 *  contenu qui le remplace ensuite. */
function FeedSkeleton({ compact }: { compact?: boolean }) {
  return (
    <div role="status" aria-busy="true" className={cn("grid gap-6 sm:grid-cols-2 lg:grid-cols-3", compact && "grid-cols-2 gap-3 lg:grid-cols-4")}>
      <span className="sr-only">Chargement…</span>
      {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className={cn("w-full rounded-xl", compact ? "h-28" : "h-72")} />)}
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
    costumSlug: props.costumSlug, pageSize: props.pageSize, filters: props.filters, sortBy: props.sortBy,
    defaultFields: props.defaultFields,
  });
  const items = ((transformedResults as unknown[]) ?? []).map(normalizeArticleResult);
  // Mode `featured:"flag"` : l'épinglée est cherchée par une MICRO-REQUÊTE serveur dédiée
  // (`{featured:true}`, 1 résultat) — jamais dans la fenêtre chargée (leçon review MR 44).
  const flagMode = props.featured === "flag";
  const pinnedQuery = usePinnedArticle({ costumSlug: props.costumSlug, filters: props.filters, sortBy: props.sortBy, defaultFields: props.defaultFields, enabled: flagMode });
  const pinned = flagMode
    ? (((pinnedQuery.transformedResults as unknown[]) ?? []).map(normalizeArticleResult))[0]
    : undefined;
  // Variant de carte (lazy, registre CARD_VARIANTS) — un variant inconnu retombe sur `default`.
  const Card = CARD_VARIANTS.get(cardVariant);
  const compactMode = props.density === "compact";

  // En mode flag, attendre AUSSI l'épinglée : sinon le repli (plus récent) s'affiche puis se fait
  // remplacer par l'épinglée au retour de la micro-requête — flash de héros.
  if (isLoading || (flagMode && pinnedQuery.isLoading)) return <FeedSkeleton compact={compactMode} />;
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

  const { hero: featured, rest } = pickFeatured(items, pinned, props.featured);
  // `compactMode` : DEUX colonnes dès le mobile (pas une, comme le reste du parc), QUATRE au maximum
  // à partir de `lg:` — gap resserré, colonnes ÉTROITES : c'est la largeur de la carte, pas seulement
  // son contenu, qui commande combien de rangées tiennent à l'écran. Écrit APRÈS `fullWidth` dans
  // `cn()` : twMerge lui donne le dernier mot sur le même palier (`xl:grid-cols-4` de `fullWidth` ne
  // fait alors plus rien de nouveau, `lg:grid-cols-4` de `compactMode` l'a déjà posé).
  const containerCls =
    feedLayout === "list"
      ? "flex flex-col gap-4"
      : cn(
          "grid gap-6 sm:grid-cols-2 lg:grid-cols-3",
          props.fullWidth && "xl:grid-cols-4",
          compactMode && "grid-cols-2 gap-3 lg:grid-cols-4",
        );
  return (
    // Suspense : le chunk de la carte (lazy) est chargé (préchargé en amont via `preload`, cf. section).
    <Suspense fallback={<FeedSkeleton compact={compactMode} />}>
      {/* eslint-disable-next-line react-hooks/static-components -- `Card` vient d'un
          REGISTRE, il n'est pas fabriqué ici : `makeVariantRegistry` referme un objet
          construit au chargement du module et `get()` n'est qu'un `variants[key] ?? default`.
          La même référence est donc renvoyée à chaque rendu — aucun état n'est remis à zéro.
          Le type ne change que si le variant change, ce qui est le comportement voulu. */}
      {featured && <div className="mb-8"><Card article={featured} href={articleHref(featured, base)} featured /></div>}
      <div className={containerCls}>
        {rest.map((a, i) => (
          <Card key={a.id ?? i} article={a} href={articleHref(a, base)} density={props.density} lastRef={i === rest.length - 1 ? (lastItemRef as never) : undefined} />
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
        {hydrated ? <Feed props={props} base={base} cardVariant={cardVariant} feedLayout={feedLayout} /> : <FeedSkeleton compact={props.density === "compact"} />}
      </div>
    </section>
  );
}
