import { createPageActionsState } from "@/lib/pageState";

/**
 * State partagé entre les sections d'une page : input texte + filtres cochés
 * (selectedFilters) + filtres dynamiques (searchByFields pour scopeList/answers).
 *
 * Producteur principal : `<FiltersSection>` (sidebar gauche).
 * Consommateurs : `<SearchProStatic>`, `<HeroSearch>`, et toute section
 * qui compose la recherche depuis le PageFiltersContext.
 */
export interface SearchByFieldValue {
  field: string;
  type?: string;
  value: string[] | Record<string, unknown>;
}

export interface PageFiltersState {
  selectedFilters: Record<string, string[]>;
  searchQuery: string;
  searchByFields: Record<string, SearchByFieldValue>;
}

const initialState: PageFiltersState = {
  selectedFilters: {},
  searchQuery: "",
  searchByFields: {},
};

/**
 * Context page-scoped des filtres de recherche.
 * Cf. `createPageActionsState` (src/lib/pageState/) pour la convention.
 */
export const PageFilters = createPageActionsState({
  name: "PageFilters",
  initialState,

  actions: ({ set, reset }) => ({
    setSelectedFilters: (
      v:
        | PageFiltersState["selectedFilters"]
        | ((prev: PageFiltersState["selectedFilters"]) => PageFiltersState["selectedFilters"])
    ) =>
      set((s) => ({
        ...s,
        selectedFilters: typeof v === "function" ? v(s.selectedFilters) : v,
      })),

    setSearchQuery: (v: string) =>
      set((s) => ({ ...s, searchQuery: v })),

    setSearchByFields: (
      v:
        | PageFiltersState["searchByFields"]
        | ((prev: PageFiltersState["searchByFields"]) => PageFiltersState["searchByFields"])
    ) =>
      set((s) => ({
        ...s,
        searchByFields: typeof v === "function" ? v(s.searchByFields) : v,
      })),

    clearFilters: () => reset(),
  }),

  derived: (s) => ({
    filterNames: Object.values(s.selectedFilters).flat() as string[],
  }),
});

/**
 * Wrapper "à plat" pour rétro-compat avec l'ancienne API
 * (`PageFiltersContext` qui exposait tout sans niveau intermédiaire).
 *
 * Préférer `PageFilters.use()` ({ state, actions }) pour le nouveau code —
 * cette signature à plat est conservée pour ne pas migrer les ~5 call sites
 * existants (FiltersSection, SearchProStatic, HeroSearch, etc.).
 */
export function usePageFilters() {
  const { state, actions } = PageFilters.use();
  return {
    selectedFilters: state.selectedFilters,
    setSelectedFilters: actions.setSelectedFilters,
    searchQuery: state.searchQuery,
    setSearchQuery: actions.setSearchQuery,
    searchByFields: state.searchByFields,
    setSearchByFields: actions.setSearchByFields,
    filterNames: state.filterNames,
    clearFilters: actions.clearFilters,
  };
}

/**
 * Version optionnelle — retourne `null` hors du Provider.
 */
export function usePageFiltersOptional() {
  const ctx = PageFilters.useOptional();
  if (!ctx) return null;
  const { state, actions } = ctx;
  return {
    selectedFilters: state.selectedFilters,
    setSelectedFilters: actions.setSelectedFilters,
    searchQuery: state.searchQuery,
    setSearchQuery: actions.setSearchQuery,
    searchByFields: state.searchByFields,
    setSearchByFields: actions.setSearchByFields,
    filterNames: state.filterNames,
    clearFilters: actions.clearFilters,
  };
}

/** Alias pour rétro-compat — utilisé par SiteRenderer. */
export const PageFiltersProvider = PageFilters.Provider;
