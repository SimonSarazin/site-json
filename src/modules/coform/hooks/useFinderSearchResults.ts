import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type {
  GlobalAutocompleteCostumData,
  SearchEntity,
} from "@communecter/cocolight-api-client";
import { useCocolight } from "@/hooks/useCocolight";
import { useDebounce } from "@/hooks/useDebounce";
import { COFORM_QUERY_KEYS } from "../constants/queryKeys";
import type { FinderConfig, FinderSearchResult, FinderElementType } from "../types";
import { toFinderSearchResult } from "../utils";
import { buildFinderMongoFilters } from "../utils/finderFilters";

/**
 * Constantes UX du finder — alignées sur le comportement historique du modal.
 */
const FINDER_DEBOUNCE_MS = 300;
const FINDER_MIN_CHARS = 2;
const FINDER_INDEX_STEP = 30;
const FINDER_STALE_TIME_MS = 30_000;

interface UseFinderSearchResultsArgs {
  /** Texte tapé par l'utilisateur (non-debounced). Le hook applique le debounce en interne. */
  query: string;
  /** Configuration du finder (type, filtres, notSourceKey...). */
  config: FinderConfig;
  /** Désactive le hook (ex: modal fermé). */
  enabled?: boolean;
}

interface UseFinderSearchResultsResult {
  /** Résultats transformés en `FinderSearchResult` (URL absolue conservée pour affichage). */
  results: FinderSearchResult[];
  /** `true` tant qu'un fetch est en cours (initial ou refetch). */
  isFetching: boolean;
  /** Erreur du dernier fetch, `null` sinon. */
  error: Error | null;
}

/**
 * Hook React Query pour la recherche d'entités via `searchCostum`, retournant
 * des `FinderSearchResult[]` prêts à consommer par l'UI Finder.
 *
 * Pourquoi un hook local plutôt qu'un wrapper du `useSearchCostumQuery` global :
 * le besoin du Finder est très spécifique (transformation `SearchEntity → FinderSearchResult`,
 * `filters` construits en DSL backend via `buildFinderMongoFilters` — inclusions +
 * exclusions, même sortie que la liste `getEligiblePlaces` — et fallbackType depuis
 * `config.type`). Le jour où un autre site aura le même besoin, on extraira un helper commun.
 *
 * Caractéristiques :
 *  - Debounce 300ms intégré (cf. `FINDER_DEBOUNCE_MS`)
 *  - `enabled` = `enabled && query.length >= 2 && !!entity` (cf. `FINDER_MIN_CHARS`)
 *  - Cache 30s (les inputs autocomplete sont rafraîchis fréquemment)
 *  - Le filtrage des éléments déjà sélectionnés se fait **côté composant**
 *    (laisser le cache RQ uniforme entre re-renders)
 *
 * @example
 *   const { results, isFetching } = useFinderSearchResults({
 *     query: searchQuery,
 *     config,
 *     enabled: isOpen,
 *   });
 */
export function useFinderSearchResults({
  query,
  config,
  enabled = true,
}: UseFinderSearchResultsArgs): UseFinderSearchResultsResult {
  const { entity, helper } = useCocolight();
  const debouncedQuery = useDebounce(query, FINDER_DEBOUNCE_MS);

  // Construit le payload de filtres backend (DSL `SearchNew::searchFilters`)
  // depuis les inclusions + exclusions du finder, via le builder PARTAGÉ (même
  // sortie que la liste collaborative `getEligiblePlaces`). `undefined` si aucun
  // filtre, pour ne pas envoyer un `filters: {}` inutile.
  const filtersPayload = useMemo<Record<string, unknown> | undefined>(() => {
    const built = buildFinderMongoFilters(config.filters ?? [], config.excludeFilters ?? []);
    return Object.keys(built).length > 0 ? built : undefined;
  }, [config.filters, config.excludeFilters]);

  const searchTypeArray = useMemo<GlobalAutocompleteCostumData["searchType"]>(
    () =>
      (Array.isArray(config.type)
        ? config.type
        : [config.type]) as GlobalAutocompleteCostumData["searchType"],
    [config.type],
  );

  const fallbackType: FinderElementType = Array.isArray(config.type)
    ? config.type[0]
    : config.type;

  const queryResult = useQuery<FinderSearchResult[], Error>({
    // queryKey stable : ne dépend pas de selectedElements (filtrage local).
    queryKey: COFORM_QUERY_KEYS.FINDER_SEARCH(
      searchTypeArray,
      debouncedQuery,
      filtersPayload,
      config.notSourceKey,
    ),
    enabled:
      enabled && !!entity && debouncedQuery.length >= FINDER_MIN_CHARS,
    staleTime: FINDER_STALE_TIME_MS,
    queryFn: async () => {
      if (!entity) throw new Error("entity not initialized");

      const param: Partial<GlobalAutocompleteCostumData> = {
        name: debouncedQuery,
        searchType: searchTypeArray,
        indexMin: 0,
        indexStep: FINDER_INDEX_STEP,
        ...(filtersPayload ? { filters: filtersPayload } : {}),
        ...(config.notSourceKey ? { notSourceKey: true } : {}),
      };

      const page = await entity.searchCostum(param);

      // PaginatorPage.results est typé T[] mais le code historique tolérait l'object
      // form `{ id: item }` — on garde Object.values en défense.
      const rawResults = Object.values(page?.results ?? {}) as unknown[];

      return rawResults
        .map((item): SearchEntity => {
          if (item && typeof item === "object" && "getEntityType" in item) {
            return item as SearchEntity;
          }
          return helper.fromEntityJSON(item, entity) as SearchEntity;
        })
        .map((sdkEntity) => toFinderSearchResult(sdkEntity, fallbackType))
        .filter((r) => !!r.id);
    },
  });

  return {
    results: queryResult.data ?? [],
    isFetching: queryResult.isFetching,
    error: queryResult.error,
  };
}
