import { useEffect, useMemo } from "react";
import { useSearchParams } from "react-router";
import { usePageFiltersOptional } from "../contexts/pageFilters";
import { useFiltersByAnswersQuery } from "./useFiltersByAnswers";
import { computeFiltersFromUrl, type FilterGroupLike } from "../lib/computeFiltersFromUrl";
import type { AnswerGroupConf } from "../lib/answerFilterClause";

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

  // Même config que celle lue par `FiltersSection` : sans elle, l'applicateur
  // headless du hero poserait un filtre par `_id` là où la sidebar pose un prédicat
  // de chemin (cf. `filterTarget`). Mémo stable : la prop est un littéral de config.
  const answerGroupConfs = useMemo(
    () => (filtersByAnswers ?? null) as Record<string, AnswerGroupConf> | null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(filtersByAnswers ?? null)],
  );

  useEffect(() => {
    if (!setSelectedFilters || !setSearchByFields) return;
    if (filterGroups.length === 0 && !filterAnswerData) return;
    const { applySelected, applySearchFields } = computeFiltersFromUrl(
      searchParams,
      filterGroups,
      filterAnswerData,
      answerGroupConfs,
    );
    setSelectedFilters(applySelected);
    setSearchByFields(applySearchFields);
  }, [searchParams, filterGroups, filterAnswerData, answerGroupConfs, setSelectedFilters, setSearchByFields]);
}
