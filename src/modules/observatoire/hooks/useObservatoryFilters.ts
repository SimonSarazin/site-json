import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import type { DimensionsConfig, ObservatoryItem, FilterValues } from "../schema";
import { applyFilters } from "../dashboard";

/**
 * État des filtres + application + SYNCHRONISATION URL (`?<id>=<valeur>`,
 * format maison sans virgule — permaliens partageables, comme les sidebars
 * du module search). L'état initial est restauré depuis l'URL au montage.
 */
export function useObservatoryFilters(
  items: ObservatoryItem[],
  dims: DimensionsConfig,
  filterIds: readonly string[],
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

  const setFilters = useCallback(
    (next: FilterValues) => {
      setFiltersState(next);
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          for (const id of filterIds) {
            const v = next[id];
            if (v) params.set(id, v);
            else params.delete(id);
          }
          return params;
        },
        { replace: true, preventScrollReset: true },
      );
    },
    [filterIds, setSearchParams],
  );

  const filtered = useMemo(
    () => applyFilters(items, filters, dims),
    [items, filters, dims],
  );

  return { filters, setFilters, filtered };
}
