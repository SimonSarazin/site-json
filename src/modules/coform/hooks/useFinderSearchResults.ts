import { useMemo } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type {
  GlobalAutocompleteCostumData,
  SearchEntity,
} from "@communecter/cocolight-api-client";
import { useCocolight } from "@/hooks/useCocolight";
import { useDebounce } from "@/hooks/useDebounce";
import { COFORM_QUERY_KEYS } from "../constants/queryKeys";
import type { FinderConfig, FinderSearchResult, FinderElementType } from "../types";
import { toFinderSearchResult } from "../utils";
import { buildFinderSearchParams, primaryFinderType } from "../utils/finderFilters";

/**
 * Constantes UX du finder — alignées sur le comportement historique du modal.
 */
const FINDER_DEBOUNCE_MS = 300;
/** Seuil de saisie, PARTAGÉ avec la modale : deux valeurs qui divergeraient laisseraient « Recherche en cours… » sans fin. */
export const FINDER_MIN_CHARS = 2;
const FINDER_INDEX_STEP = 30;
const FINDER_STALE_TIME_MS = 30_000;

/** Sans entité hôte, la recherche ne peut pas partir : une erreur à dire, plutôt qu'une attente sans fin. */
const HOTE_INDISPONIBLE = new Error("Finder : entité hôte indisponible, recherche impossible");

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
  /**
   * La réponse affichée est CELLE de la saisie courante : debounce écoulé, et pas une liste conservée
   * d'une recherche précédente. Seule une réponse courante peut conclure « aucun résultat » — et
   * proposer « Ajouter ». Faux sous le seuil.
   */
  isCurrentAnswer: boolean;
  /** Erreur de la recherche de la saisie courante, `null` sinon (et pendant le debounce). */
  error: Error | null;
  /** Relance la recherche de la saisie courante. */
  retry: () => void;
  /** Une relance peut aboutir : faux sans entité hôte, où « Réessayer » ne ferait rien de visible. */
  canRetry: boolean;
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
 *  - `enabled` = `enabled && query.length >= FINDER_MIN_CHARS && !!entity`
 *  - Cache 30s (les inputs autocomplete sont rafraîchis fréquemment)
 *  - La réponse PRÉCÉDENTE reste affichée pendant la recherche suivante (`keepPreviousData`) : la liste
 *    ne se vide plus à chaque frappe. Mais une réponse conservée — même vide — ne dit rien de la saisie
 *    en cours : `isCurrentAnswer` est seul à pouvoir conclure (« aucun résultat », « Ajouter »)
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

  // Type(s), filtres DSL (inclusions + exclusions, même sortie que la liste
  // collaborative `getEligiblePlaces`) et périmètre, via le builder PARTAGÉ —
  // aussi utilisé par la liste « J'utilise » de la fiche commun.
  const searchParams = useMemo(
    () =>
      buildFinderSearchParams({
        type: config.type,
        filters: config.filters,
        excludeFilters: config.excludeFilters,
        notSourceKey: config.notSourceKey,
        sourceKey: config.sourceKey,
      }),
    [config.type, config.filters, config.excludeFilters, config.notSourceKey, config.sourceKey],
  );
  const filtersPayload = searchParams.filters;
  const searchTypeArray = searchParams.searchType as GlobalAutocompleteCostumData["searchType"];

  const fallbackType: FinderElementType = primaryFinderType(config.type);

  const seuilAtteint = debouncedQuery.length >= FINDER_MIN_CHARS;
  const actif = enabled && !!entity && seuilAtteint;

  const queryResult = useQuery<FinderSearchResult[], Error>({
    // queryKey stable : ne dépend pas de selectedElements (filtrage local).
    queryKey: COFORM_QUERY_KEYS.FINDER_SEARCH(
      searchTypeArray,
      debouncedQuery,
      filtersPayload,
      config.notSourceKey,
      searchParams.sourceKey,
    ),
    enabled: actif,
    staleTime: FINDER_STALE_TIME_MS,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      if (!entity) throw new Error("entity not initialized");

      const param: Partial<GlobalAutocompleteCostumData> = {
        name: debouncedQuery,
        indexMin: 0,
        indexStep: FINDER_INDEX_STEP,
        ...searchParams,
        searchType: searchTypeArray,
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

  // Le debounce est écoulé : la requête porte sur ce qui est tapé, pas sur la frappe d'avant.
  const aJour = debouncedQuery === query;

  // Sous le seuil, rien — pas même la réponse conservée d'une recherche précédente.
  return {
    results: actif ? queryResult.data ?? [] : [],
    isFetching: queryResult.isFetching,
    isCurrentAnswer: actif && aJour && queryResult.data !== undefined && !queryResult.isPlaceholderData,
    error: enabled && seuilAtteint && aJour ? (entity ? queryResult.error : HOTE_INDISPONIBLE) : null,
    retry: () => {
      void queryResult.refetch();
    },
    canRetry: !!entity,
  };
}
