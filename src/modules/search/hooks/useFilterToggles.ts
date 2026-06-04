import { usePageFilters } from "../contexts/pageFilters";
import {
  toggleSearchByField,
  toggleSelectedFilters,
  type FilterLevel,
  type ToggleFieldArgs,
} from "../lib/filterToggles";

/**
 * Logique d'écriture des filtres partagée entre producteurs du
 * `PageFiltersContext` (sidebar `<FiltersSection>`, header horizontal à venir).
 *
 * Wrappe `usePageFilters()` (état + setters) et expose les toggles fondés sur
 * les réducteurs purs `lib/filterToggles`. Retourne aussi tout l'état/les
 * actions du contexte (`...pf`) pour pouvoir remplacer `usePageFilters()` 1:1.
 */
export function useFilterToggles() {
  const pf = usePageFilters();
  const { setSelectedFilters, setSearchByFields } = pf;

  /** Toggle d'un filtre catégorie (`selectedFilters[groupId]`). */
  const toggleSelected = (groupId: string, filterName: string) =>
    setSelectedFilters((prev) => toggleSelectedFilters(prev, groupId, filterName));

  /** Toggle d'un filtre par champ (`searchByFields[filterName]`). */
  const toggleField = (filterName: string, args: ToggleFieldArgs) =>
    setSearchByFields((prev) => toggleSearchByField(prev, filterName, args));

  /**
   * Signature historique de `FiltersSection.toggleFilter`, conservée pour ne
   * pas réécrire ses call sites : `field` + `value` présents → filtre par champ,
   * sinon → filtre catégorie.
   */
  const toggleFilter = (
    groupId: string,
    filterName: string,
    field: string | null = null,
    value: string | string[] | null = null,
    level: FilterLevel | null = null,
    fieldType: string | null = null,
  ) => {
    if (field && value !== null) {
      toggleField(filterName, { field, value, level, fieldType });
    } else {
      toggleSelected(groupId, filterName);
    }
  };

  return { ...pf, toggleSelected, toggleField, toggleFilter };
}
