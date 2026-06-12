import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import type { DimensionsConfig, Equipment, FilterValues } from "../schema";
import {
  BOOL_FILTER_VALUES,
  dimensionBool,
  dimensionList,
  dimensionValue,
} from "../dimensions";

/**
 * Filtrage CLIENT générique : ET strict entre dimensions, sémantique par
 * `kind` (value : égalité · list : appartenance · anyTrue : oui/non).
 * Côté client par design : le dashboard agrège tout le dataset en mémoire —
 * filtrer serveur signifierait tout recharger à chaque clic (le module
 * search reste le bon outil pour les LISTES paginées filtrées serveur).
 */
function applyFilters(
  data: Equipment[],
  f: FilterValues,
  dims: DimensionsConfig,
): Equipment[] {
  const active = Object.entries(f).filter(([id, v]) => v && dims[id]);
  if (active.length === 0) return data;
  return data.filter((d) =>
    active.every(([id, v]) => {
      const def = dims[id];
      if (def.kind === "anyTrue") {
        return dimensionBool(d, def) === (v === BOOL_FILTER_VALUES.TRUE);
      }
      if (def.kind === "list") return dimensionList(d, def).includes(v);
      return dimensionValue(d, def) === v;
    }),
  );
}

/**
 * État des filtres + application + SYNCHRONISATION URL (`?<id>=<valeur>`,
 * format maison sans virgule — permaliens partageables, comme les sidebars
 * du module search). L'état initial est restauré depuis l'URL au montage.
 */
export function useObservatoryFilters(
  equipments: Equipment[],
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
    () => applyFilters(equipments, filters, dims),
    [equipments, filters, dims],
  );

  return { filters, setFilters, filtered };
}
