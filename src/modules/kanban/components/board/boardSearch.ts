import { useMemo, useState } from "react";
import { countActiveFilters, EMPTY_FILTER, type BoardFilterCriteria } from "@/modules/kanban/lib/boardFilter";

/** Axe de regroupement des vues qui en acceptent un (Liste). */
export type BoardGroupBy = "column" | "status" | "priority" | "assignee" | "none";

/** Clé de tri des vues ordonnables (Liste, Table). */
export type BoardSortKey = "rank" | "title" | "dueDate" | "priority" | "status";

export type BoardSortDirection = "asc" | "desc";

export const BOARD_GROUP_BY_VALUES: readonly BoardGroupBy[] = ["column", "status", "priority", "assignee", "none"];

export const BOARD_SORT_KEYS: readonly BoardSortKey[] = ["rank", "title", "dueDate", "priority", "status"];

/**
 * État de recherche, de filtrage et d'organisation du tableau des actions.
 *
 * Repris du contexte `boardSearch` de co-kanban. L'état vit dans la mise en page du tableau
 * (`ActionsLayout`), au-dessus des vues : la barre de filtres, « Grouper » et « Trier » le
 * modifient, chaque vue le lit dans le contexte de sa route. Passer du Tableau à la Liste garde
 * donc la recherche et les filtres.
 *
 * Tout est CLIENT : aucune requête n'est refaite quand on tape. `criteria` se donne tel quel à
 * `filterCards(snapshot, criteria)`, le même moteur pur pour la barre et toutes les vues.
 */
export interface BoardSearch {
  /** Texte brut du champ de recherche, tel qu'il est saisi. */
  text: string;
  /** Critères des filtres, SANS le texte : c'est l'état que les popovers éditent. */
  filters: BoardFilterCriteria;
  /** Filtres + texte : la forme à passer à `filterCards`. */
  criteria: BoardFilterCriteria;
  /** Compte de « Réinitialiser » (la recherche libre n'y est pas comptée). */
  activeFilterCount: number;
  groupBy: BoardGroupBy;
  sortKey: BoardSortKey;
  sortDirection: BoardSortDirection;
  setText: (text: string) => void;
  setFilters: (filters: BoardFilterCriteria) => void;
  resetFilters: () => void;
  setGroupBy: (groupBy: BoardGroupBy) => void;
  setSort: (key: BoardSortKey, direction: BoardSortDirection) => void;
}

export function useBoardSearch(): BoardSearch {
  const [text, setText] = useState("");
  const [filters, setFilters] = useState<BoardFilterCriteria>(EMPTY_FILTER);
  const [groupBy, setGroupBy] = useState<BoardGroupBy>("column");
  const [sort, setSortState] = useState<{ key: BoardSortKey; direction: BoardSortDirection }>({ key: "rank", direction: "asc" });

  return useMemo(() => {
    const trimmed = text.trim();
    return {
      text,
      filters,
      // Le texte n'entre dans les critères qu'une fois DÉBARRASSÉ de ses espaces : une barre
      // d'espace laissée dans le champ ne doit pas vider l'écran. `useMemo` : les vues diffèrent
      // ces critères (`useDeferredValue`), une référence neuve à chaque rendu les relancerait.
      criteria: trimmed === "" ? filters : { ...filters, text: trimmed },
      activeFilterCount: countActiveFilters(filters),
      groupBy,
      sortKey: sort.key,
      sortDirection: sort.direction,
      setText,
      setFilters,
      resetFilters: () => setFilters(EMPTY_FILTER),
      setGroupBy,
      setSort: (key: BoardSortKey, direction: BoardSortDirection) => setSortState({ key, direction }),
    };
  }, [text, filters, groupBy, sort]);
}
