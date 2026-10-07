import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import type { DimensionsConfig, ObservatoryItem, FilterValues } from "../schema";
import type { LabelMaps } from "../dimensions";
import { applyFilters, applySelection, applyTextSearch } from "../dashboard";

/** Paramètre URL de la recherche texte (même nom que le module search). */
const SEARCH_PARAM = "q";
/** Paramètre URL de la sélection (clic sur un item de la liste du mode `split`).
 *  Distinct de `q` : les deux filtres se cumulent et s'effacent séparément. */
const SELECTION_PARAM = "selection";

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
  /** Libellés canoniques (dimensions à `keyPaths`) — regroupement filtre/recherche. */
  labels?: LabelMaps,
  /** Dimensions ciblées par la SÉLECTION (cf. `props.list.selectDimensions`). */
  selectionDimIds?: readonly string[],
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
  // `q` reçoit une valeur DÉJÀ STABILISÉE : la saisie immédiate (et son
  // debounce) vivent DANS <Filters> — isolation d'état : la frappe ne
  // re-rend que l'input, jamais la section (KPI/charts/table). C'est la
  // version « compiler-friendly » de React.memo : restructurer plutôt que
  // mémoïser.
  const [q, setQ] = useState<string>(() => searchParams.get(SEARCH_PARAM) ?? "");
  // Sélection : posée d'UN clic (pas de frappe, donc pas de debounce à isoler).
  const [selection, setSelection] = useState<string>(
    () => searchParams.get(SELECTION_PARAM) ?? "",
  );

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

  const setQAndSync = useCallback(
    (next: string) => {
      setQ(next);
      writeParams((params) => {
        if (next.trim()) params.set(SEARCH_PARAM, next.trim());
        else params.delete(SEARCH_PARAM);
      });
    },
    [writeParams],
  );

  const setSelectionAndSync = useCallback(
    (next: string) => {
      setSelection(next);
      writeParams((params) => {
        if (next.trim()) params.set(SELECTION_PARAM, next.trim());
        else params.delete(SELECTION_PARAM);
      });
    },
    [writeParams],
  );

  /** Efface filtres, recherche et sélection d'un coup (état « aucun résultat »). */
  const resetAll = useCallback(() => {
    setFiltersState({});
    setQ("");
    setSelection("");
    writeParams((params) => {
      for (const id of filterIds) params.delete(id);
      params.delete(SEARCH_PARAM);
      params.delete(SELECTION_PARAM);
    });
  }, [filterIds, writeParams]);

  const filtered = useMemo(
    () =>
      applySelection(
        applyTextSearch(applyFilters(items, filters, dims, labels), q, dims, searchDimIds, labels),
        selection,
        dims,
        selectionDimIds ?? [],
        labels,
      ),
    [items, filters, dims, q, searchDimIds, labels, selection, selectionDimIds],
  );

  return {
    filters,
    setFilters,
    q,
    setQ: setQAndSync,
    selection,
    setSelection: setSelectionAndSync,
    resetAll,
    filtered,
  };
}
