import { useMemo } from "react";
import type { SearchEntity } from "@communecter/cocolight-api-client";
import { useSearchAllResults } from "@/modules/search/hooks/useSearchAllResults";
import type { SearchType } from "@/modules/search/schema";
import type {
  DataObservatorySectionProps,
  DimensionsConfig,
  ObservatoryItem,
} from "../schema";
import { fieldsFromDimensions } from "../dimensions";
import { OBSERVATORY_QUERY_KEYS } from "../constants/queryKeys";

// AUCUN défaut métier ici : le périmètre (defaultFilters) ET les dimensions
// viennent de la config de section. Sans périmètre → on ne requête rien
// (pas de fallback silencieux sur un dataset particulier).

type BaseParamsProp = DataObservatorySectionProps["baseParams"];

/**
 * Normalisation des baseParams de la section → baseParams de useSearchQuery.
 * Fonction PURE, partagée avec le prefetch SSR (`../prefetch.ts`) : la
 * queryKey React Query est structurelle — serveur et client doivent produire
 * EXACTEMENT le même objet pour que l'hydratation tombe sur le bon cache.
 *
 * La projection (`defaultFields`) est DÉRIVÉE des dimensions déclarées
 * (racine de chaque chemin + champs SDK) : on ne demande au backend que ce
 * que le dashboard consomme — surchargeable via `baseParams.defaultFields`.
 */
export function buildObservatoryBaseParams(
  baseParamsProp: BaseParamsProp | undefined,
  dimensions: DimensionsConfig,
) {
  return {
    notSourceKey: baseParamsProp?.notSourceKey ?? true,
    defaultTypes: (baseParamsProp?.defaultTypes as SearchType[] | undefined) ?? [
      "poi" as SearchType,
    ],
    defaultFields: baseParamsProp?.defaultFields ?? fieldsFromDimensions(dimensions),
    defaultFilters: baseParamsProp?.defaultFilters,
    defaultSortBy: baseParamsProp?.defaultSortBy,
    indexStepList: baseParamsProp?.indexStepList ?? 500,
  };
}

/**
 * Les résultats de `searchCostum` sont des entités SDK typées : le document
 * vit dans `serverData` (règle maison, comme toutes les cartes search) — on
 * le prend BRUT, sans schéma métier : seuls les champs déclarés en
 * dimensions sont lus (coercions tolérantes au moment de la lecture).
 */
function toItems(results: readonly SearchEntity[]): {
  items: ObservatoryItem[];
  entities: SearchEntity[];
} {
  const items: ObservatoryItem[] = [];
  const entities: SearchEntity[] = [];
  for (const item of results) {
    const sd = item?.serverData;
    if (sd && typeof sd === "object") {
      items.push(sd as ObservatoryItem);
      entities.push(item); // ALIGNÉ index à index avec items (rowAction preview)
    }
  }
  return { items, entities };
}

export function useObservatoryItemsQuery(
  baseParamsProp: BaseParamsProp | undefined,
  dimensions: DimensionsConfig,
) {
  // Prérequis : le périmètre des données vient de la config. Sans lui, la
  // query est désactivée (searchType null → useSearchQuery ne fetch pas).
  const hasPerimeter = !!baseParamsProp?.defaultFilters;
  if (import.meta.env.DEV && !hasPerimeter) {
    console.warn(
      "[observatoire] baseParams.defaultFilters absent de la config — aucune donnée ne sera chargée (périmètre source.key/type requis)",
    );
  }

  const baseParams = useMemo(
    () => buildObservatoryBaseParams(baseParamsProp, dimensions),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(baseParamsProp), JSON.stringify(dimensions)],
  );

  const searchType = useMemo<Record<string, string[]> | null>(
    () => (hasPerimeter ? { type: baseParams.defaultTypes as unknown as string[] } : null),
    [hasPerimeter, baseParams.defaultTypes],
  );

  // Chargement du périmètre COMPLET (pages séquentielles, plafond, progress)
  // — mécanique générique du module search.
  const { results, loaded, total, isComplete, capped, isLoading, error } =
    useSearchAllResults({
      queryKeyPrefix: OBSERVATORY_QUERY_KEYS.ITEMS_PREFIX,
      searchType,
      baseParams,
      // Variant SDK (ex. "navigator-tl") — aligné sur les sections search du
      // costum ; inclus dans la queryKey (cf. prefetch SSR pour l'hydratation).
      variant: baseParamsProp?.variant,
      maxResults: baseParamsProp?.maxResults,
    });

  const { items, entities } = useMemo(() => toItems(results), [results]);

  return {
    items,
    /** Entités SDK alignées avec `items` (preview/détail du module search). */
    entities,
    isLoading,
    error,
    stillLoading: !isComplete,
    /** Progression du chargement (total connu dès la 1ʳᵉ page). */
    progress: { loaded, total },
    capped,
  };
}
