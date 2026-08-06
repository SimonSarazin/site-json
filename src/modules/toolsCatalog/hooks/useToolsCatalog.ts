import { useEffect, useMemo, useRef } from "react";
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
  const isReady = !loading && !!api && !!formId && !!step && !!finderPath;

  const payload = useMemo(() => buildToolsPayload(query, indexStep), [query, indexStep]);

  const {
    data,
    error,
    fetchNextPage,
    hasNextPage,
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
      const form = await api.form({ id: formId });
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
    isFetchingNextPage,
    isLoading,
    isPending,
    refetch,
    lastItemRef,
  };
}
