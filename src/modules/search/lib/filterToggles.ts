import type { PageFiltersState, SearchByFieldValue } from "../contexts/pageFilters";

/**
 * Réducteurs purs (sans React) de la sélection de filtres partagée
 * (`PageFiltersContext`). Source unique de la logique d'écriture des filtres,
 * consommée par `useFilterToggles` puis par `<FiltersSection>` (sidebar) et le
 * futur header horizontal.
 *
 * Critique : le *shape* produit dans `searchByFields` / `selectedFilters` est
 * consommé tel quel par `<SearchProStatic>` (construction du payload backend).
 * Toute modification de forme ici doit être couverte par `filterToggles.test.ts`
 * sous peine de casser silencieusement le filtrage des résultats.
 */

export type FilterLevel = "cities" | "level1" | "level2" | "level3" | "level4" | "level5";

/**
 * Toggle l'appartenance d'un filtre catégorie à `selectedFilters[groupId]`.
 * Présent → retiré, absent → ajouté. Les autres groupes/valeurs sont préservés.
 */
export function toggleSelectedFilters(
  prev: PageFiltersState["selectedFilters"],
  groupId: string,
  filterName: string,
): PageFiltersState["selectedFilters"] {
  const current = prev[groupId] || [];
  const updated = current.includes(filterName)
    ? current.filter((name) => name !== filterName)
    : [...current, filterName];
  return { ...prev, [groupId]: updated };
}

export interface ToggleFieldArgs {
  field: string;
  value: string | string[];
  /** Filtre de zone (`scopeList`) — encode `value` en `{ id, type: level }`. */
  level?: FilterLevel | null;
  /** Filtre par champ natif typé (ex. `sourceKey`) — conserve le `type`. */
  fieldType?: string | null;
}

/**
 * Toggle d'un filtre par champ dans `searchByFields[filterName]` (add/remove).
 * Trois formes de sortie, identiques à l'historique `FiltersSection.toggleFilter` :
 *  - `scopeList` (level) → `{ field, type: "scopeList", value: { id, type: level } }`
 *  - champ typé (fieldType) → `{ field, type: fieldType, value: string[] }`
 *  - champ simple → `{ field, value: string[] }`
 */
export function toggleSearchByField(
  prev: PageFiltersState["searchByFields"],
  filterName: string,
  { field, value, level = null, fieldType = null }: ToggleFieldArgs,
): PageFiltersState["searchByFields"] {
  const isActive = Object.keys(prev).includes(filterName);
  if (isActive) {
    const { [filterName]: _removed, ...rest } = prev;
    void _removed;
    return rest;
  }

  if (level) {
    return {
      ...prev,
      [filterName]: {
        field,
        type: "scopeList",
        value: { id: value, type: level },
      } as unknown as SearchByFieldValue,
    };
  }

  if (fieldType) {
    const valueToSet = Array.isArray(value) ? value : [value];
    return { ...prev, [filterName]: { field, type: fieldType, value: valueToSet } };
  }

  const valueToSet = Array.isArray(value) ? value : [value];
  return { ...prev, [filterName]: { field, value: valueToSet } };
}

/**
 * Pose/retire le filtre par date d'un groupe `dateRange` dans
 * `searchByFields[groupId]` (clé = id du GROUPE : une seule plage par groupe).
 * `start`/`end` vides → entrée retirée. Shape produit :
 * `{ field, type: "dateRange", value: { start?, end? } }`, consommé par
 * `searchByFieldsToQuery` (→ `filters[field].$gt`, seul opérateur date
 * converti par le backend — cf. schema.ts).
 */
export function setDateRange(
  prev: PageFiltersState["searchByFields"],
  groupId: string,
  field: string,
  range: { start?: string; end?: string },
): PageFiltersState["searchByFields"] {
  const start = range.start?.trim() ?? "";
  const end = range.end?.trim() ?? "";
  const { [groupId]: _removed, ...rest } = prev;
  void _removed;
  if (!start && !end) return rest;
  return {
    ...rest,
    [groupId]: {
      field,
      type: "dateRange",
      value: { ...(start ? { start } : {}), ...(end ? { end } : {}) },
    } as unknown as SearchByFieldValue,
  };
}

/**
 * Toggle d'une option de groupe `searchTargets` (filtre « type d'info ») dans
 * `searchByFields` — sémantique RADIO : sélectionner une option retire toutes
 * les autres options du même groupe (une seule cible de recherche à la fois) ;
 * re-cliquer l'option active revient à « Tout » (aucune entrée).
 * Shape produit : `{ field: "searchTarget", type: "searchTarget", value: target }`,
 * consommé par `searchByFieldsToQuery` (sortie `searchTarget`).
 */
export function toggleSearchTarget(
  prev: PageFiltersState["searchByFields"],
  groupOptionNames: string[],
  filterName: string,
  target: Record<string, unknown>,
): PageFiltersState["searchByFields"] {
  const wasActive = Object.prototype.hasOwnProperty.call(prev, filterName);
  const rest = Object.fromEntries(
    Object.entries(prev).filter(([key]) => !groupOptionNames.includes(key)),
  );
  if (wasActive) return rest;
  return {
    ...rest,
    [filterName]: { field: "searchTarget", type: "searchTarget", value: target },
  };
}
