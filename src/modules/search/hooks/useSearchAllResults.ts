import { useEffect } from "react";
import { useSearchQuery } from "./useSearchQuery";

type UseSearchQueryParams = Parameters<typeof useSearchQuery>[0];

/**
 * Plafond de sécurité par défaut : au-delà, on ARRÊTE d'enchaîner les pages
 * (un périmètre mal borné ne doit pas aspirer un index entier).
 */
export const SEARCH_ALL_DEFAULT_MAX_RESULTS = 5000;

export interface UseSearchAllResultsParams {
  /** Préfixe de clé React Query (single source of truth du consommateur). */
  queryKeyPrefix: string;
  /** `null` → query désactivée (aucun appel réseau) — cf. useSearchQuery. */
  searchType: Record<string, string[]> | null;
  baseParams: UseSearchQueryParams["baseParams"];
  /** Plafond de résultats chargés. Défaut : {@link SEARCH_ALL_DEFAULT_MAX_RESULTS}. */
  maxResults?: number;
  /** Texte recherché (vue carte : le périmètre suit les filtres). Défaut "". */
  searchText?: string;
  /** Tags cochés (idem). Défaut {}. */
  searchTags?: Record<string, string[]>;
  /** Payload map (`mapUsed: true` + `indexStepMap`) — vue carte. Défaut false. */
  mapUsed?: boolean;
  /** Variant SDK (parité avec la liste). */
  variant?: UseSearchQueryParams["variant"];
}

/**
 * Charge le périmètre COMPLET d'une recherche (toutes les pages) — pour les
 * écrans qui agrègent l'ensemble du dataset (dashboards, exports…), par
 * opposition à l'infinite-scroll de `useSearchQuery`.
 *
 * Stratégie : pages enchaînées SÉQUENTIELLEMENT (le paginator du SDK et
 * `fetchNextPage` sont séquentiels par contrat — le curseur de chaque page
 * dérive de la précédente). Une seule requête en vol par utilisateur :
 * auto-régulé, pas de rafale sur le backend. Le rendu est PROGRESSIF :
 * `results` grossit à chaque page, `total` est connu dès la première
 * (→ barre de progression possible côté UI).
 *
 * SSR : la première page peut être préchargée (`prefetchSearchResults` avec
 * la MÊME queryKey) — après hydratation, l'enchaînement reprend où le serveur
 * s'est arrêté.
 */
export function useSearchAllResults({
  queryKeyPrefix,
  searchType,
  baseParams,
  maxResults = SEARCH_ALL_DEFAULT_MAX_RESULTS,
  searchText = "",
  searchTags = {},
  mapUsed = false,
  variant,
}: UseSearchAllResultsParams) {
  const {
    transformedResults,
    totalCount,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useSearchQuery({
    queryKeyPrefix,
    searchText,
    searchTags,
    searchType,
    mapUsed,
    variant,
    baseParams,
    // Cache LONG : recharger ce dashboard = re-chaîner TOUTES les pages
    // (séquentiel) — un retour sur la page dans la demi-heure doit être
    // instantané (pages en cache), pas une re-cascade réseau.
    cache: { staleTime: 30 * 60 * 1000, gcTime: 60 * 60 * 1000 },
  });

  const results = transformedResults ?? [];
  const loaded = results.length;
  const capped = loaded >= maxResults;

  // Chargement total : tant qu'il reste une page (et sous le plafond), on
  // enchaîne. Une page à la fois — voir le commentaire de tête.
  useEffect(() => {
    if (hasNextPage && !capped && !isFetchingNextPage && !isLoading) {
      void fetchNextPage();
    }
  }, [hasNextPage, capped, isFetchingNextPage, isLoading, fetchNextPage]);

  useEffect(() => {
    if (import.meta.env.DEV && capped && hasNextPage) {
      console.warn(
        `[useSearchAllResults:${queryKeyPrefix}] plafond maxResults=${maxResults} atteint — ` +
          `chargement interrompu (total annoncé : ${totalCount ?? "?"})`,
      );
    }
  }, [capped, hasNextPage, maxResults, queryKeyPrefix, totalCount]);

  const isComplete = !isLoading && (!hasNextPage || capped);

  return {
    results,
    /** Nombre d'items chargés jusqu'ici (progressif). */
    loaded,
    /** Total annoncé par le backend (connu dès la 1ʳᵉ page), sinon null. */
    total: totalCount ?? null,
    /** Vrai quand tout est chargé (ou plafonné). */
    isComplete,
    /** Vrai si l'arrêt vient du plafond `maxResults`. */
    capped,
    isLoading,
    isFetchingNextPage,
    error,
  };
}
