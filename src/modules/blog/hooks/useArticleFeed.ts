import { useCallback, useMemo, useState } from "react";
import { useSearchQuery } from "@/modules/search/hooks/useSearchQuery";
import { usePageFiltersOptional } from "@/modules/search/contexts/pageFilters";
import { searchByFieldsToQuery } from "@/modules/search/lib/searchByFieldsToQuery";
import { mergeMongoFilters } from "@/modules/search/lib/mongoFilters";
import { BLOG_QUERY_KEYS } from "../constants/queryKeys";
import { articleFields } from "../constants/fields";

/**
 * Fil d'articles d'un costum (POI type=article, scope source.key) — paginé, trié par date décroissante.
 * Réutilise `useSearchQuery` (searchCostum) : searchType poi + defaultFilters type=article + scope costum.
 *
 * **Piloté par le `PageFilters` partagé de la page** (exactement comme `SearchProStatic`) : un `heroSearch`
 * ou un `searchHeader` de la MÊME page écrit le texte + les filtres → le fil re-requête automatiquement
 * (la queryKey de useSearchQuery inclut searchText/searchTags/baseParams). Le filtrage est donc
 * CONFIG-DRIVEN et agnostique au champ :
 *  - filtres SANS `field` (types/tags) → `searchTags` ($all) ;
 *  - filtres AVEC `field` (ex. un champ `list` ajouté au costum form article) → `{ <field>: { $in } }`
 *    fusionné dans `defaultFilters` (via `searchByFieldsToQuery`, comme la liste search).
 * Hors provider PageFilters, tout est vide → fil de base (comportement P0).
 */
export interface UseArticleFeedParams {
  costumSlug: string;
  pageSize?: number;
  filters?: Record<string, unknown>;
  /** Tri serveur (défaut `{created:-1}`). Doit être IDENTIQUE entre fil et épinglée. */
  sortBy?: Record<string, 1 | -1>;
  /** Champs projetés EN PLUS du contrat d'article du module (cf. ARTICLE_FIELDS). */
  defaultFields?: readonly string[];
}

export function useArticleFeed({ costumSlug, pageSize = 12, filters, sortBy, defaultFields }: UseArticleFeedParams) {
  const cf = usePageFiltersOptional();
  const searchText = cf?.searchQuery ?? "";
  const filterNames = cf?.filterNames;
  const searchByFields = cf?.searchByFields;

  // Filtres sans `field` (types/tags cochés) → searchTags ($all). Clé canonique `tags` (comme
  // SearchProStatic) — buildSearchPayload aplatit de toute façon les valeurs, mais on garde la convention.
  const searchTags = useMemo(
    (): Record<string, string[]> => (filterNames && filterNames.length ? { tags: [...filterNames] } : {}),
    [filterNames],
  );
  // Filtres avec `field` (ex. champ `list` du costum) → filtres Mongo `{ field: { $in } }`
  // (locality/sourceKeys ignorés : le fil est scopé au costum, pas de scopeList — cf. doc §14).
  const fieldFilters = useMemo(
    () => searchByFieldsToQuery(searchByFields ?? {}).filters,
    [searchByFields],
  );

  const feed = useSearchQuery({
    queryKeyPrefix: BLOG_QUERY_KEYS.FEED_PREFIX(costumSlug),
    searchText,
    searchTags,
    // ⚠ searchType explicite obligatoire (buildSearchPayload n'applique defaultTypes que si type===undefined).
    searchType: { type: ["poi"] },
    mapUsed: false,
    baseParams: {
      indexStepList: pageSize,
      // fieldFilters fusionnés comme `canonicalSearchProStaticBaseParams` (dans defaultFilters).
      // NB : le masquage des articles EN ATTENTE de validation (double flag toBeValidated) est posé
      // AUTOMATIQUEMENT par buildSearchPayload (applyValidationGate) dès qu'un costumSlug est présent.
      // Cf doc/19-visibility-system.md (Visibilité des données) + doc/32-module-articles-blog.md.
      // `type: "article"` en DERNIER = garantie d'immuabilité (un filtre field:"type" ne peut pas l'écraser).
      defaultFilters: { ...mergeMongoFilters(filters ?? {}, fieldFilters), type: "article" },
      defaultSortBy: sortBy ?? { created: -1 },
      // Projection EXPLICITE : sans elle le legacy réduit le POI et retire `publicationDate`
      // (la date éditoriale affichée par les cartes) et `category`. Cf. constants/fields.ts.
      defaultFields: articleFields(defaultFields),
      // scope costum : lus par buildSearchPayload via cast (présents en config, hors type strict).
      costumSlug,
      sourceKey: [costumSlug],
    } as never,
  });

  // Signature du périmètre filtré — change dès qu'un `searchHeader`/`heroSearch` de la page modifie
  // le fil (cf. en-tête du fichier) : sert à remettre la pagination « pages » à la page 1 plutôt que
  // de laisser l'utilisateur sur une page qui n'a plus de sens pour le nouveau périmètre.
  const filterSignature = useMemo(
    () => JSON.stringify({ searchText, searchTags, fieldFilters }),
    [searchText, searchTags, fieldFilters],
  );

  return { ...feed, filterSignature };
}

/**
 * Navigation « pages » (`articleFeed.pagination:"pages"`) au-dessus du curseur `next()` du backend.
 *
 * Le backend ne sait paginer QUE par curseur — un `indexMin` manuel est ignoré (cf.
 * `buildSearchPayload`, sondé sur le chemin carte) — donc il est impossible de sauter directement
 * à une page N jamais chargée : il faut avoir chargé N-1 avant elle. Ce hook ne propose donc jamais
 * un saut au-delà de la page suivante immédiate (`fetchedPages`) : les pages déjà visitées basculent
 * instantanément (déjà en cache React Query), et la seule page « nouvelle » atteignable déclenche
 * exactement UN `fetchNextPage()` avant d'afficher son index — jamais de chaîne de fetch, donc pas
 * de risque de désynchronisation entre l'état local `pageIndex` et le nombre de pages réellement
 * chargées.
 */
export function usePagedFeedNav({ fetchedPages, hasNextPage, isFetchingNextPage, fetchNextPage, resetSignal }: {
  /** Nombre de pages déjà en cache (`data.pages.length`). */
  fetchedPages: number;
  hasNextPage?: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => Promise<unknown>;
  /** Remet `pageIndex` à 0 dès que cette valeur change (ex. `filterSignature`). */
  resetSignal: unknown;
}) {
  const [pageIndex, setPageIndex] = useState(0);
  const [isNavigating, setIsNavigating] = useState(false);
  // Reset PENDANT le rendu (pas dans un effet, cf. "Adjusting state when a prop changes" — React
  // docs) : évite un rendu intermédiaire avec l'ancienne page sur le nouveau périmètre filtré.
  const [prevSignal, setPrevSignal] = useState(resetSignal);
  if (resetSignal !== prevSignal) {
    setPrevSignal(resetSignal);
    setPageIndex(0);
  }

  const goToPage = useCallback((index: number) => {
    if (index < 0 || index === pageIndex) return;
    if (index < fetchedPages) { setPageIndex(index); return; }
    // `index === fetchedPages` uniquement : la seule page jamais chargée atteignable en un fetch.
    if (index === fetchedPages && hasNextPage) {
      setIsNavigating(true);
      // React Query RÉSOUT (ne rejette pas) un `fetchNextPage` en échec — `.then()` s'exécute donc
      // aussi côté erreur. Sans la vérification `pages.length > index`, `pageIndex` avancerait sur
      // une page jamais chargée : `safeIndex` la clampe (rien de visible), mais `goToPage(index)`
      // sort ensuite immédiatement sur `index === pageIndex` — « Suivant » resterait figé jusqu'au
      // prochain changement de filtre, sans toast (`error && !items.length` reste faux).
      fetchNextPage()
        .then((result) => {
          const pages = (result as { data?: { pages?: unknown[] } } | undefined)?.data?.pages;
          if ((pages?.length ?? 0) > index) setPageIndex(index);
        })
        .finally(() => setIsNavigating(false));
    }
  }, [pageIndex, fetchedPages, hasNextPage, fetchNextPage]);

  // Clamp de sûreté : un reset de données (nouveau filtre) réduit `fetchedPages` à 1 avant que
  // l'effet ci-dessus n'ait remis `pageIndex` à 0 — évite un instant de page hors bornes.
  const safeIndex = Math.min(pageIndex, Math.max(fetchedPages - 1, 0));

  return {
    pageIndex: safeIndex,
    pageCount: hasNextPage ? fetchedPages + 1 : fetchedPages,
    isNavigating: isNavigating || isFetchingNextPage,
    canGoPrev: safeIndex > 0,
    canGoNext: safeIndex < fetchedPages - 1 || !!hasNextPage,
    goToPage,
    goPrev: () => goToPage(safeIndex - 1),
    goNext: () => goToPage(safeIndex + 1),
  };
}

/**
 * L'article ÉPINGLÉ du scope (mode `featured:"flag"`) : micro-requête serveur `{featured:true}`,
 * 1 résultat, même tri que le fil (la plus récente des épinglées si un double-flag résiduel
 * traîne — rien ne disparaît, le fil liste tout). `enabled` : ne fetch qu'en mode flag.
 * Requête SERVEUR délibérément (pas un scan de la fenêtre chargée) : l'épinglée peut être
 * ancienne et vivre hors des pages chargées — la leçon du finding review MR 44.
 */
export function usePinnedArticle({ costumSlug, filters, sortBy, defaultFields, enabled }: {
  costumSlug: string;
  filters?: Record<string, unknown>;
  sortBy?: Record<string, 1 | -1>;
  defaultFields?: readonly string[];
  enabled: boolean;
}) {
  return useSearchQuery({
    queryKeyPrefix: BLOG_QUERY_KEYS.FEED_PREFIX(costumSlug),
    searchText: "",
    searchTags: {},
    searchType: { type: ["poi"] },
    mapUsed: false,
    enabled,
    baseParams: {
      indexStepList: 1,
      // `featured` puis `type` en DERNIER : un filtre de config ne peut écraser ni l'un ni l'autre.
      defaultFilters: { ...(filters ?? {}), featured: true, type: "article" },
      defaultSortBy: sortBy ?? { created: -1 },
      defaultFields: articleFields(defaultFields),
      costumSlug,
      sourceKey: [costumSlug],
    } as never,
  });
}
