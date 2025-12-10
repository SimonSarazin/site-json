/**
 * Point d'entrée centralisé pour les query keys React Query
 *
 * Les query keys sont définis dans chaque module (single source of truth).
 * Ce fichier re-exporte tout pour un accès unifié si besoin.
 */

// Re-export des query keys des modules
export { NEWS_QUERY_KEYS } from "@/modules/news/constants/queryKeys";
export { QUERY_KEYS as PROFILE_QUERY_KEYS } from "@/modules/profil/constants/queryKeys";
export { SEARCH_QUERY_KEYS } from "@/modules/search/constants/queryKeys";

// Re-export des types
export type { NewsQueryKeyType } from "@/modules/news/constants/queryKeys";
export type { QueryKeyType as ProfileQueryKeyType } from "@/modules/profil/constants/queryKeys";
export type { SearchQueryKeyParams, SearchQueryKeyType } from "@/modules/search/constants/queryKeys";
