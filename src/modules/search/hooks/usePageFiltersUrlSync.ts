import { useEffect } from "react";
import { useSearchParams } from "react-router";
import { usePageFiltersOptional } from "../contexts/pageFilters";
import { useFiltersByAnswersQuery } from "./useFiltersByAnswers";
import { computeFiltersFromUrl, type FilterGroupLike } from "../lib/computeFiltersFromUrl";

export interface UsePageFiltersUrlSyncOptions {
  id?: string;
  /** Groupes de filtres « tag » (ex. typologies) — options statiques de la config. */
  filterGroups?: FilterGroupLike[];
  /** Filtres form-based (ex. services) — résolus en `orgaNameArray`. */
  filtersByAnswers?: Record<string, unknown>;
}

/**
 * Applicateur de filtres **headless** : lit les query params d'URL + résout les
 * `filtersByAnswers` (services form-based) et publie l'état `PageFilters`
 * correspondant — sans aucune UI.
 *
 * Permet à la home de filtrer **exactement comme `/lieux`** (même
 * `computeFiltersFromUrl` que `FiltersSection`) : le hero pose `?typologies=…` /
 * `?services=…` comme le nav, ce hook applique → liste + autocomplete cohérents.
 */
export function usePageFiltersUrlSync({
  id,
  filterGroups = [],
  filtersByAnswers,
}: UsePageFiltersUrlSyncOptions): void {
  const [searchParams] = useSearchParams();
  const pageFilters = usePageFiltersOptional();
  const setSelectedFilters = pageFilters?.setSelectedFilters;
  const setSearchByFields = pageFilters?.setSearchByFields;

  // Même seed de queryKey que `FiltersSection` / `prefetchFilterSection`
  // (`filters-answers-${sectionId}`) → le prefetch SSR (générique, cf.
  // `findFiltersSections`) hydrate ce cache : pas de flash ni de refetch client.
  const answerResult = useFiltersByAnswersQuery(
    `filters-answers-${id ?? "anonymous"}`,
    (filtersByAnswers ?? {}) as Parameters<typeof useFiltersByAnswersQuery>[1],
  );
  const filterAnswerData = filtersByAnswers ? answerResult.data : null;

  useEffect(() => {
    if (!setSelectedFilters || !setSearchByFields) return;
    if (filterGroups.length === 0 && !filterAnswerData) return;
    const { applySelected, applySearchFields } = computeFiltersFromUrl(
      searchParams,
      filterGroups,
      filterAnswerData,
    );
    setSelectedFilters(applySelected);
    setSearchByFields(applySearchFields);
  }, [searchParams, filterGroups, filterAnswerData, setSelectedFilters, setSearchByFields]);
}
