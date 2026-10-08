import "../i18n"; // side-effect : namespace i18n "modules/blog"
import { Suspense, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useT } from "@/hooks/useT";
import { useHydrated } from "@/hooks/useHydrated";
import { useSite } from "@/hooks/useSite";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
} from "@/components/ui/pagination";
import { cn } from "@/lib/utils";
import { useArticleFeed, usePagedFeedNav, usePinnedArticle } from "../hooks/useArticleFeed";
import { CARD_VARIANTS } from "../variants/cards";
import { normalizeArticleResult, articleHref } from "../lib/articleLink";
import { pickFeatured } from "../lib/pickFeatured";
import { buildPageRange } from "../lib/paginationRange";
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
function Feed({ props, base, cardVariant, feedLayout, defaultFields, pagination }: {
  props: ArticleFeedSectionProps;
  base: string;
  cardVariant?: string;
  feedLayout: "grid" | "list";
  defaultFields?: readonly string[];
  pagination: "infinite" | "pages";
}) {
  const t = useT("modules/blog");
  const pagedMode = pagination === "pages";
  const { data, transformedResults, lastItemRef, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage, error, refetch, filterSignature, totalCount, hasCount, pageSize } = useArticleFeed({
    costumSlug: props.costumSlug, pageSize: props.pageSize, filters: props.filters, sortBy: props.sortBy,
    defaultFields,
  });
  const nav = usePagedFeedNav({
    fetchedPages: data?.pages?.length ?? 0,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    resetSignal: filterSignature,
  });
  // `nav.pageCount` n'est QUE le nombre de pages navigables maintenant (visitées + la suivante
  // immédiate, cf. `usePagedFeedNav`) — pas le nombre réel de pages du fil, qui continue de grandir
  // à mesure qu'on avance. L'annoncer tel quel à un lecteur d'écran (« Page 3 sur 5 ») laisserait
  // croire qu'il n'y a que 5 pages. Le backend renvoie un total RÉEL (`totalCount`/`hasCount`,
  // `count.total` de la recherche) quand il est disponible — on s'en sert pour l'annonce, sans
  // toucher `nav.pageCount` qui reste la source de vérité pour les boutons et leurs bornes.
  const totalPages = hasCount ? Math.max(1, Math.ceil(totalCount / pageSize)) : nav.pageCount;
  const items = ((transformedResults as unknown[]) ?? []).map(normalizeArticleResult);
  // Mode `featured:"flag"` : l'épinglée est cherchée par une MICRO-REQUÊTE serveur dédiée
  // (`{featured:true}`, 1 résultat) — jamais dans la fenêtre chargée (leçon review MR 44).
  const flagMode = props.featured === "flag";
  const pinnedQuery = usePinnedArticle({ costumSlug: props.costumSlug, filters: props.filters, sortBy: props.sortBy, defaultFields, enabled: flagMode });
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

  // En mode `pages`, la une est toujours résolue sur la PREMIÈRE page (page 0) — jamais sur la page
  // affichée — pour que « le plus récent »/l'épinglée reste stable quelle que soit la page consultée
  // (au lieu de désigner le 1ᵉʳ article de CETTE page). `rest` est ensuite la page courante, dédupliquée
  // de la une par id : une épinglée ancienne (`featured:"flag"`) peut vivre naturellement sur n'importe
  // quelle page et ne doit pas s'y afficher deux fois.
  const page0Items = pagedMode
    ? ((data?.pages?.[0]?.results as unknown[]) ?? []).map(normalizeArticleResult)
    : items;
  const { hero: featured, rest: restPage0 } = pickFeatured(page0Items, pinned, props.featured);
  const currentPageItems = pagedMode
    ? ((data?.pages?.[nav.pageIndex]?.results as unknown[]) ?? []).map(normalizeArticleResult)
    : items;
  const rest = pagedMode ? currentPageItems.filter((a) => a.id !== featured?.id) : restPage0;
  const showHero = !pagedMode || nav.pageIndex === 0;
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
      {showHero && featured && <div className="mb-8"><Card article={featured} href={articleHref(featured, base)} featured /></div>}
      <div className={containerCls}>
        {rest.map((a, i) => (
          <Card
            key={a.id ?? i}
            article={a}
            href={articleHref(a, base)}
            density={props.density}
            lastRef={!pagedMode && i === rest.length - 1 ? (lastItemRef as never) : undefined}
          />
        ))}
      </div>
      {pagedMode ? (
        nav.pageCount > 1 && (
          <div className="flex flex-col items-center gap-2 py-6">
            <span className="sr-only" role="status">{t("feed.pageOf", undefined, { current: nav.pageIndex + 1, total: totalPages })}</span>
            {/* Un fil navigué page après page accumule des pages déjà chargées sans plafond (le
                curseur backend interdit tout saut, cf. `usePagedFeedNav`) — `buildPageRange` tronque
                en « 1 … 8 9 10 … 32 » dès que ça déborderait, au lieu de rendre un bouton par page
                (passait à la ligne dès ~30). */}
            <Pagination>
              <PaginationContent className="flex-wrap justify-center">
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    aria-label={t("feed.previous")}
                    aria-disabled={!nav.canGoPrev}
                    className={cn(!nav.canGoPrev && "pointer-events-none opacity-50")}
                    onClick={(e) => { e.preventDefault(); nav.goPrev(); }}
                  >
                    {t("feed.previous")}
                  </PaginationPrevious>
                </PaginationItem>
                {buildPageRange(nav.pageCount, nav.pageIndex).map((item, idx) =>
                  item === "ellipsis" ? (
                    <PaginationItem key={`ellipsis-${idx}`}>
                      <PaginationEllipsis />
                    </PaginationItem>
                  ) : (
                    <PaginationItem key={item}>
                      <PaginationLink
                        href="#"
                        isActive={item === nav.pageIndex}
                        aria-label={t("feed.page", undefined, { n: item + 1 })}
                        onClick={(e) => { e.preventDefault(); nav.goToPage(item); }}
                      >
                        {item + 1}
                      </PaginationLink>
                    </PaginationItem>
                  ),
                )}
                <PaginationItem>
                  <PaginationNext
                    href="#"
                    aria-label={t("feed.next")}
                    aria-disabled={!nav.canGoNext}
                    className={cn(!nav.canGoNext && "pointer-events-none opacity-50")}
                    onClick={(e) => { e.preventDefault(); nav.goNext(); }}
                  >
                    {t("feed.next")}
                  </PaginationNext>
                </PaginationItem>
              </PaginationContent>
            </Pagination>
            {nav.isNavigating && <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden />}
          </div>
        )
      ) : (
        <>
          {isFetchingNextPage && <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>}
          {hasNextPage && !isFetchingNextPage && (
            <div className="flex justify-center py-6"><Button variant="outline" onClick={() => fetchNextPage()}>{t("feed.loadMore")}</Button></div>
          )}
        </>
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
  // `defaultFields` FUSIONNE (pas d'écrasement) : un site pose les champs costum communs à TOUS ses
  // fils une fois dans `config.blog`, une section garde la liberté d'en demander d'autres en plus.
  const defaultFields = [...new Set([...(blogCfg?.defaultFields ?? []), ...(props.defaultFields ?? [])])];
  const pagination = (props.pagination ?? blogCfg?.defaultPagination ?? "infinite") as "infinite" | "pages";
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
        {hydrated ? <Feed props={props} base={base} cardVariant={cardVariant} feedLayout={feedLayout} defaultFields={defaultFields} pagination={pagination} /> : <FeedSkeleton compact={props.density === "compact"} />}
      </div>
    </section>
  );
}
