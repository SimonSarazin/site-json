import { useEffect, useMemo, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { ToolsCatalogPage, ToolsCatalogFacets } from "@communecter/cocolight-api-client";
import { useCocolight } from "@/hooks/useCocolight";
import { useInfiniteQueryScroll } from "@/hooks/useInfiniteQueryScroll";
import { TOOLS_CATALOG_QUERY_KEYS } from "../constants/queryKeys";
import { buildToolsPayload, type ToolsCatalogQuery } from "../utils/buildToolsPayload";

interface UseToolsCatalogOptions {
  formId: string | null | undefined;
  step: string | null | undefined;
  finderPath: string | null | undefined;
  /** Recherche + filtres (déjà debouncés par l'appelant pour la recherche). */
  query: ToolsCatalogQuery;
  /** Taille de page serveur (défaut 24). */
  indexStep?: number;
  enabled?: boolean;
}

/**
 * Catalogue d'outils d'usage PAGINÉ + RECHERCHÉ CÔTÉ SERVEUR (défilement infini).
 * Réutilise `useInfiniteQueryScroll` : le `pageParam` = `indexMin` (skip), la
 * page suivante est chargée quand `lastItemRef` entre dans le viewport.
 *
 * NB : les résultats sont des DTO plats (pas des entités SDK) → pas de transform SSR.
 */
export function useToolsCatalog({
  formId,
  step,
  finderPath,
  query,
  indexStep = 24,
  enabled = true,
}: UseToolsCatalogOptions) {
  const { api, loading } = useCocolight();
  const queryClient = useQueryClient();
  // `configReady` (statique, ne dépend que du JSON de la section) est séparé de
  // `isReady` (runtime, api en cours d'init) : la config n'étant jamais validée par
  // Zod au runtime, un `formId`/`step`/`finderPath` manquant laisserait la query
  // désactivée en `pending` pour toujours → squelette perpétuel. On rend donc
  // `isPending && configReady` (état vide au lieu du squelette), tout en gardant le
  // squelette pendant l'init de l'api (configReady vrai, query pas encore lancée).
  const configReady = !!formId && !!step && !!finderPath;
  const isReady = !loading && !!api && configReady;

  useEffect(() => {
    if (import.meta.env.DEV && !configReady) {
      console.warn(
        "[toolsCatalog] Config de section incomplète : formId, step et finderPath sont requis.",
        { formId, step, finderPath },
      );
    }
  }, [configReady, formId, step, finderPath]);

  const payload = useMemo(() => buildToolsPayload(query, indexStep), [query, indexStep]);

  const {
    data,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchNextPageError,
    isFetching,
    isFetchingNextPage,
    isLoading,
    isPending,
    refetch,
    lastItemRef,
  } = useInfiniteQueryScroll<ToolsCatalogPage>({
    queryKey: TOOLS_CATALOG_QUERY_KEYS.LIST(
      formId ?? null,
      step ?? null,
      finderPath ?? null,
      payload.name ?? "",
      payload.filters ?? {},
    ),
    queryFn: async ({ pageParam }) => {
      if (!api || !formId || !step || !finderPath) {
        throw new Error("Paramètres du catalogue d'outils incomplets");
      }
      // `api.form({id})` télécharge le document Form complet : instance mise en
      // cache (staleTime Infinity) et partagée entre les pages du scroll — un seul
      // téléchargement au lieu d'un par page/filtre.
      const form = await queryClient.ensureQueryData({
        queryKey: TOOLS_CATALOG_QUERY_KEYS.FORM_INSTANCE(formId),
        queryFn: () => api.form({ id: formId }),
        staleTime: Infinity,
      });
      return form.toolsCatalog({
        step,
        finderPath,
        ...payload,
        indexMin: typeof pageParam === "number" ? pageParam : 0,
      });
    },
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((n, p) => n + p.results.length, 0);
      // Garde `results.length > 0` : si le backend renvoie une page vide alors que
      // `loaded < total` (divergence agrégation/count), on stoppe au lieu de boucler.
      return loaded < lastPage.count.total && lastPage.results.length > 0 ? loaded : undefined;
    },
    options: {
      initialPageParam: 0,
      enabled: enabled && isReady,
      // Le catalogue évolue peu : cache court, refetch évité au ré-affichage.
      staleTime: 60 * 1000,
    },
  });

  const tools = useMemo(() => data?.pages.flatMap((p) => p.results) ?? [], [data]);
  const totalCount = data?.pages[0]?.count.total ?? 0;

  // Garde les dernières facettes connues pendant un refetch (recherche/filtre) : les
  // Select de filtre ne se vident pas le temps du chargement de la nouvelle page.
  const liveFacets = data?.pages[0]?.facets;
  const lastFacets = useRef<ToolsCatalogFacets>({ categories: [], usages: [] });
  useEffect(() => {
    if (liveFacets) lastFacets.current = liveFacets;
  }, [liveFacets]);
  const facets = liveFacets ?? lastFacets.current;

  return {
    tools,
    totalCount,
    facets,
    error: (error ?? null) as Error | null,
    fetchNextPage,
    hasNextPage,
    isFetchNextPageError,
    isFetching,
    isFetchingNextPage,
    isLoading,
    isPending: isPending && configReady,
    refetch,
    lastItemRef,
  };
}
