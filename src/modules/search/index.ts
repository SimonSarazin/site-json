/**
 * Module Search
 *
 * Recherche avancée avec filtres, carte, pagination infinie, et système de
 * filtres partagés via context (PageFilters).
 *
 * Ce barrel expose l'API publique du module. Les sous-modules (sections,
 * hooks, contexts, prefetch, lib) restent importables par chemin direct
 * pour permettre un tree-shaking plus fin sur les usages spécifiques.
 */

// ──────────────── Composants containers (consommés par les wrappers section) ────
export { default as SearchPro } from "./SearchPro";
export { default as SearchProStatic } from "./SearchProStatic";

// ──────────────── Schemas ────────────────────────────────────────────────
export {
  // Sections
  FiltersSectionSchema,
  SearchProSectionSchema,
  SearchProStaticSectionSchema,
  CardCountCTSectionSchema,
  ThematicsSectionSchema,
  SearchHeaderSectionSchema,
  TitleWithFiltersRezoLaMerSchema,
  // Variants SDK (searchCostum)
  SearchVariantSchema,
  SearchBySchema,
  // Constants
  SEARCH_TYPE_ICON_NAMES,
  FILIERE_ICON_MAPPING,
} from "./schema";

// ──────────────── Types ──────────────────────────────────────────────────
export type {
  // Sections
  FiltersSection,
  FiltersSectionProps,
  SearchProSection,
  SearchProSectionProps,
  SearchProStaticSection,
  SearchProStaticSectionProps,
  CardCountCTSection,
  CardCountCTSectionProps,
  ThematicsSection,
  ThematicsSectionProps,
  // Variants SDK
  SearchVariant,
  SearchBy,
  // Configs utilisées dans SearchProStatic.props
  AddButtonConfig,
  ZoneSelectorConfig,
  CsvButtonConfig,
  TagSelectorConfig,
  // Types UI / composants
  TagsFilter,
  ListConf,
  MapConf,
  SearchType,
  SearchListViewProps,
  SearchCardProps,
  PreviewProps,
  SearchMapProps,
  MapPopupProps,
} from "./schema";

// ──────────────── Contexts & Providers ───────────────────────────────────
export {
  PageFilters,
  PageFiltersProvider,
  usePageFilters,
  usePageFiltersOptional,
} from "./contexts/pageFilters";
export type {
  PageFiltersState,
  SearchByFieldValue,
} from "./contexts/pageFilters";

export { SearchPropsContext } from "./contexts/SearchPropsContext";
export { SearchPropsProvider } from "./contexts/SearchPropsProvider";

// ──────────────── Hooks ──────────────────────────────────────────────────
export { useSearchProps, useSearchPropsOptional } from "./hooks/useSearchProps";
export { useSearchQuery, type UseSearchQueryParams } from "./hooks/useSearchQuery";
export {
  buildSearchPayload,
  type SearchBaseParamsInput,
  type BuildSearchPayloadOverrides,
} from "./lib/buildSearchPayload";
export { useAutocomplete } from "./hooks/useAutocomplete";
export {
  useFiltersByAnswersQuery,
  filtersByAnswersQueryKey,
  fetchFiltersByAnswers,
  type FiltersByAnswersOptions,
  type FilterAnswerType,
} from "./hooks/useFiltersByAnswers";
export {
  useSearchZoneQuery,
  searchZoneQueryKey,
  fetchSearchZones,
  type SearchZoneOptions,
} from "./hooks/useSearchZone";

// ──────────────── Prefetch (SSR) ─────────────────────────────────────────
export {
  prefetchSearchResults,
  findFiltersSections,
  prefetchSearchZones,
  prefetchFiltersByAnswers,
  prefetchFilterSection,
  type SearchPrefetchParams,
} from "./prefetch";

// ──────────────── Constants ──────────────────────────────────────────────
export {
  SEARCH_QUERY_KEYS,
  type SearchQueryKeyParams,
  type SearchQueryKeyType,
} from "./constants/queryKeys";

// ──────────────── Lib (helpers utilitaires) ──────────────────────────────
export {
  canonicalSearchProStaticBaseParams,
  type CanonicalBaseParamsInput,
} from "./lib/canonicalBaseParams";
