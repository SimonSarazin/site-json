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
export { AMPLI_QUERY_KEYS } from "@/modules/ampli/constants/queryKeys";
export { CAGNOTTE_QUERY_KEYS } from "@/modules/cagnotte/constants/queryKeys";
export { COFORM_QUERY_KEYS } from "@/modules/coform/constants/queryKeys";
export { INTEROP_QUERY_KEYS } from "@/modules/interop/constants/queryKeys";
export { NEWS_QUERY_KEYS } from "@/modules/news/constants/queryKeys";
export { PROFIL_QUERY_KEYS } from "@/modules/profil/constants/queryKeys";
export { SEARCH_QUERY_KEYS } from "@/modules/search/constants/queryKeys";

import { AGENDA_QUERY_KEYS } from "@/modules/agenda/constants/queryKeys";
import { BLOG_QUERY_KEYS } from "@/modules/blog/constants/queryKeys";
import { SEARCH_QUERY_KEYS as SEARCH_KEYS } from "@/modules/search/constants/queryKeys";
import type { QueryKey } from "@tanstack/react-query";

/**
 * Préfixes des surfaces PUBLIQUES qu'une mutation de VISIBILITÉ doit rafraîchir : listes de
 * recherche (annuaire/carte/compteurs), agenda (calendrier + liste), fil blog.
 *
 * POURQUOI ici, et pourquoi une fonction : ces préfixes sont FIXES dans le code
 * (`SearchProStatic.tsx:352` pose `"searchCostumStatic"` en dur, l'agenda `["agenda", …]`), mais ils
 * appartiennent à TROIS modules. Chaque chemin de mutation en a redécouvert la nécessité seul :
 *  - création standard → `SEARCH_LISTS_INVALIDATION` (les 5 préfixes search), 2026 ;
 *  - formulaires costum → `invalidate:event` / `invalidate:blog` ajoutent agenda et fil, ailleurs ;
 *  - actions ADMIN (valider, référencer, supprimer) → n'invalidaient QUE `admin-*`, donc une fiche
 *    validée depuis `/admin` restait périmée sur la page publique jusqu'au rechargement.
 * Une liste composée à un seul endroit évite la quatrième redécouverte.
 *
 * Le fil blog est scopé par slug ; `costumSlug` absent → il est simplement omis.
 */
export function publicSurfaceKeys(costumSlug?: string): QueryKey[] {
  return [
    SEARCH_KEYS.RESULTS_PREFIX("searchCostumStatic"),
    SEARCH_KEYS.RESULTS_PREFIX("searchCostumStaticMapAll"),
    SEARCH_KEYS.RESULTS_PREFIX("searchCostum"),
    SEARCH_KEYS.RESULTS_PREFIX("searchCostumMapAll"),
    SEARCH_KEYS.RESULTS_PREFIX("cardCountCT"),
    AGENDA_QUERY_KEYS.CALENDAR_PREFIX(),
    AGENDA_QUERY_KEYS.LIST_PREFIX(),
    // `FEED_PREFIX` renvoie la CHAÎNE `blog:<slug>` — c'est un `queryKeyPrefix` de `useSearchQuery`,
    // donc il se transforme en clé par la même fonction que les autres.
    ...(costumSlug ? [SEARCH_KEYS.RESULTS_PREFIX(BLOG_QUERY_KEYS.FEED_PREFIX(costumSlug))] : []),
  ];
}

// Re-export des types associés
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
