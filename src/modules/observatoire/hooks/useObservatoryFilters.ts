import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { useDebounce } from "@/hooks/useDebounce";
import type { DimensionsConfig, ObservatoryItem, FilterValues } from "../schema";
import { applyFilters, applyTextSearch } from "../dashboard";

/** Paramètre URL de la recherche texte (même nom que le module search). */
const SEARCH_PARAM = "q";

/** Délai de stabilisation de la saisie avant filtrage + écriture URL : sans
 *  lui, CHAQUE frappe re-filtrait le dataset, re-rendait les 5 charts
 *  recharts et déclenchait une navigation router (saisie hachée). */
const SEARCH_DEBOUNCE_MS = 250;

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
  // `q` = valeur IMMÉDIATE (l'input reste fluide) ; le pipeline de filtrage
  // et le miroir URL consomment la valeur débouncée.
  const [q, setQ] = useState<string>(() => searchParams.get(SEARCH_PARAM) ?? "");
  const debouncedQ = useDebounce(q, SEARCH_DEBOUNCE_MS);

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

  // Miroir URL de la recherche — une fois la saisie STABILISÉE (débouncée),
  // et seulement si la valeur a réellement changé (pas de navigation au
  // montage ni de replace redondant).
  const lastWrittenQ = useRef(searchParams.get(SEARCH_PARAM) ?? "");
  useEffect(() => {
    const next = debouncedQ.trim();
    if (next === lastWrittenQ.current) return;
    lastWrittenQ.current = next;
    writeParams((params) => {
      if (next) params.set(SEARCH_PARAM, next);
      else params.delete(SEARCH_PARAM);
    });
  }, [debouncedQ, writeParams]);

  const filtered = useMemo(
    () => applyTextSearch(applyFilters(items, filters, dims), debouncedQ, dims, searchDimIds),
    [items, filters, dims, debouncedQ, searchDimIds],
  );

  return { filters, setFilters, q, setQ, filtered };
}
