import type { EnhancedNavItemType } from "@/types/site-schema";
import { capitaliser, isDynamicList, staticListValues } from "@/lib/costumLists";

/** Plafond par défaut d'entrées affichées dans un menu généré depuis `costum.lists` — un
 *  dropdown de header n'a pas vocation à afficher les 300 valeurs qu'un filtre de page
 *  peut proposer (cf. `PLAFOND` dans `useDynamicFilterOptions`). */
export const DEFAULT_DYNAMIC_NAV_LIMIT = 20;

/** Page + filtre cible d'un item `dynamicList` — sous-ensemble de ce que renvoie
 *  `getDropdownFilterOwner` (`@/modules/search/lib/dropdownFilters`), repris ici pour ne
 *  pas coupler ce module au type complet du filtre. */
export interface DynamicNavOwner {
  pathname: string;
  filter: { id: string };
}

/**
 * Valeurs à afficher pour un item `dynamicList`, selon la forme sous laquelle
 * `costum.lists.<nom>` est déclarée — même distinction que `useDynamicFilterOptions`
 * (`optionsKey` statique / `optionsFrom` dynamique), appliquée à un menu plutôt qu'à un
 * filtre de page.
 *
 * @param declared      la déclaration brute (`costum.lists[list]`), telle que lue par
 *                       `useCostumListsReactive`.
 * @param dynamicValues  résultat déjà résolu par `costum/co/listvalues`, SEULEMENT
 *                       pertinent si `declared` est une recette dynamique.
 */
export function resolveDynamicNavValues(
  declared: unknown,
  dynamicValues: string[] | undefined,
): string[] {
  if (isDynamicList(declared)) return dynamicValues ?? [];
  return staticListValues(declared) ?? [];
}

/**
 * Convertit des valeurs de liste en `children` de nav : chaque entrée est un lien vers la
 * page propriétaire du filtre cible, portant déjà la valeur en query param (même format
 * qu'un clic sur une facette, `dropdownFilterToParam`) — un `<NavLink>` ordinaire suffit
 * donc à naviguer ET appliquer le filtre, sans passer par `useDropdownFilterNav` :
 * `usePageFiltersUrlSync` lit l'URL au montage de la page cible, que la navigation change
 * de route ou seulement de query params sur la même page.
 *
 * Sans libellé traduit (les valeurs de `costum.lists` sont saisies librement, pas
 * traduites) : seule la casse d'affichage est retouchée (`capitaliser`), comme pour les
 * options générées par `useDynamicFilterOptions`.
 */
export function buildDynamicNavChildren(
  owner: DynamicNavOwner,
  values: string[],
  limit: number = DEFAULT_DYNAMIC_NAV_LIMIT,
): EnhancedNavItemType[] {
  return values.slice(0, Math.max(0, limit)).map((value) => {
    // Pré-encodage AVANT `.set()`, même convention que `dropdownFilterToParam` (dropdownFilters.ts) :
    // `.set()` encode une 2e fois à la sérialisation, ce qui protège une virgule LITTÉRALE dans
    // `value` (valeur réellement observée en base sur ce type de liste, ex. « Salon professionnel, »
    // — cf. commentaire de `dropdownFilterToParam`). Sans ce double encodage, `raw.split(",")` côté
    // lecture (`SearchHeaderSection`) couperait la valeur en deux à tort et le filtre échouerait
    // silencieusement à s'appliquer.
    const params = new URLSearchParams();
    params.set(owner.filter.id, encodeURIComponent(value));
    return {
      label: { fr: capitaliser(value), en: capitaliser(value) },
      path: `${owner.pathname}?${params.toString()}`,
    };
  });
}
