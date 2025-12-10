/**
 * Module Search
 *
 * Module pour la recherche avancée avec filtres, carte et pagination infinie.
 */

// Composants principaux
export { default as SearchSection } from "./SearchProSection";
export { default as SearchPro } from "./SearchPro";
export { default as SearchProStatic } from "./SearchProStatic";

// Schemas & Types - explicit
export {
  SearchProSectionSchema,
  SearchProStaticSectionSchema,
  SEARCH_TYPE_ICON_NAMES,
} from "./schema";

export type {
  SearchProSection,
  SearchProSectionProps,
  SearchProStaticSection,
  SearchProStaticSectionProps,
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

// Constants - explicit
export { SEARCH_QUERY_KEYS } from "./constants/queryKeys";
export type { SearchQueryKeyParams, SearchQueryKeyType } from "./constants/queryKeys";

// Prefetch - explicit
export { prefetchSearchResults, type SearchPrefetchParams } from "./prefetch";
