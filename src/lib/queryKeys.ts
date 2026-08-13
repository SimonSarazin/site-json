/**
 * Point d'entrée centralisé pour les query keys React Query.
 *
 * Les query keys sont définies dans chaque module (single source of truth).
 * Ce fichier re-exporte tout pour un accès unifié si besoin — mais les
 * consommateurs doivent **préférer importer directement depuis le module**
 * concerné (`@/modules/X/constants/queryKeys`) pour des raisons de
 * tree-shaking et de clarté.
 *
 * Convention « or » des 6 fichiers (cf. `commentaire/retour-equipe-refactor-
 * mai-2026.md` section 2.17) :
 * - Nom préfixé `XXX_QUERY_KEYS` en SCREAMING_SNAKE_CASE
 * - `as const` sur l'objet englobant et sur chaque retour
 * - Type exporté via `ReturnType<...>`
 * - `*_PREFIX()` pour invalidations cross-contexte
 * - Dimension user (`userId`/`userContextId`) si le résultat dépend du user
 * - JSDoc obligatoire : Producteur + Consommateurs invalidants
 */

// Clés TRANSVERSES (hors module) : leur donnée est consommée par plusieurs
// modules, et l'invalidation doit les atteindre tous.
export { COSTUM_QUERY_KEYS } from "@/constants/queryKeys";
export type { CostumQueryKeyType } from "@/constants/queryKeys";

// Re-export des query keys des 7 modules (ampli, cagnotte, coform, interop,
// news, profil, search — ordre alphabétique).
export { AAC_QUERY_KEYS } from "@/modules/aac/constants/queryKeys";
export { AMPLI_QUERY_KEYS } from "@/modules/ampli/constants/queryKeys";
export { CAGNOTTE_QUERY_KEYS } from "@/modules/cagnotte/constants/queryKeys";
export { COFORM_QUERY_KEYS } from "@/modules/coform/constants/queryKeys";
export { INTEROP_QUERY_KEYS } from "@/modules/interop/constants/queryKeys";
export { NEWS_QUERY_KEYS } from "@/modules/news/constants/queryKeys";
export { PROFIL_QUERY_KEYS } from "@/modules/profil/constants/queryKeys";
export { SEARCH_QUERY_KEYS } from "@/modules/search/constants/queryKeys";

// Re-export des types associés
export type { AacQueryKeyType } from "@/modules/aac/constants/queryKeys";
export type { AmpliQueryKeyType } from "@/modules/ampli/constants/queryKeys";
export type { CagnotteQueryKeyType } from "@/modules/cagnotte/constants/queryKeys";
export type { CoformQueryKeyType } from "@/modules/coform/constants/queryKeys";
export type { InteropQueryKeyType } from "@/modules/interop/constants/queryKeys";
export type { NewsQueryKeyType } from "@/modules/news/constants/queryKeys";
export type { ProfilQueryKeyType } from "@/modules/profil/constants/queryKeys";
export type {
  SearchQueryKeyParams,
  SearchQueryKeyType,
} from "@/modules/search/constants/queryKeys";
