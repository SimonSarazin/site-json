/**
 * Factories pour les contextes React partagés entre sections d'une même page
 * (= "page-scoped state"). Convention établie pour les modules qui veulent
 * exposer un état partagé sans coupler le code générique (SiteRenderer) à
 * leur module.
 *
 * Pattern actuellement disponible :
 * - `createPageActionsState` — état + actions + valeurs dérivées. Cas le plus
 *   courant (cf. PageFilters dans modules/search).
 *
 * À venir si besoin avéré :
 * - `createPageSimpleState` — juste { state, set } pour les états triviaux.
 * - `createPageReducerState` — pattern reducer pour la logique métier riche
 *   (multi-step, validations conditionnelles, etc.).
 */
export {
  createPageActionsState,
  type PageActionsContextValue,
  type PageActionsHelpers,
  type PageActionsStateResult,
} from "./createPageActionsState";
