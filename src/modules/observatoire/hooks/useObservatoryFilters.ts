import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import type { DimensionsConfig, ObservatoryItem, FilterValues } from "../schema";
import { applyFilters, applyTextSearch } from "../dashboard";

/** Paramètre URL de la recherche texte (même nom que le module search). */
const SEARCH_PARAM = "q";

/**
 * État des filtres + recherche texte + application + SYNCHRONISATION URL
 * (`?<id>=<valeur>` et `?q=…`, format maison sans virgule — permaliens
 * partageables, comme les sidebars du module search). L'état initial est
 * restauré depuis l'URL au montage.
 */
export function useObservatoryFilters(
  items: ObservatoryItem[],
  dims: DimensionsConfig,
  filterIds: readonly string[],
  /** Dimensions ciblées par la recherche texte (cf. `props.search.dimensions`). */
  searchDimIds?: readonly string[],
) {
  const [searchParams, setSearchParams] = useSearchParams();

  // Restauration depuis l'URL — au montage uniquement (ensuite l'état local
  // est la source, l'URL est un miroir écrit en `replace`).
  const [filters, setFiltersState] = useState<FilterValues>(() => {
    const initial: FilterValues = {};
    for (const id of filterIds) {
      const v = searchParams.get(id);
      if (v) initial[id] = v;
    }
    return initial;
  });
  const [q, setQState] = useState<string>(() => searchParams.get(SEARCH_PARAM) ?? "");

  const writeParams = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          mutate(params);
          return params;
        },
        { replace: true, preventScrollReset: true },
      );
    },
    [setSearchParams],
  );

  const setFilters = useCallback(
    (next: FilterValues) => {
      setFiltersState(next);
      writeParams((params) => {
        for (const id of filterIds) {
          const v = next[id];
          if (v) params.set(id, v);
          else params.delete(id);
        }
      });
    },
    [filterIds, writeParams],
  );

  const setQ = useCallback(
    (next: string) => {
      setQState(next);
      writeParams((params) => {
        if (next.trim()) params.set(SEARCH_PARAM, next);
        else params.delete(SEARCH_PARAM);
      });
    },
    [writeParams],
  );

  const filtered = useMemo(
    () => applyTextSearch(applyFilters(items, filters, dims), q, dims, searchDimIds),
    [items, filters, dims, q, searchDimIds],
  );

  return { filters, setFilters, q, setQ, filtered };
}
