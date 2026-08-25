/**
 * `creatable` EFFECTIF d'un champ `valueSelect` : `saveNewValue` RESTREINT la saisie libre aux admins,
 * ne l'élargit JAMAIS — un champ `creatable: false` reste fermé quel que soit `saveNewValue`/`isAdmin`.
 *
 * Motivation : quand un champ promeut aussi ses valeurs libres dans `costum.lists.<list>` (taxonomie
 * PARTAGÉE, cf. `growCostumLists`), un visiteur non-admin ne doit pas pouvoir taper une valeur inédite —
 * seulement choisir parmi l'existant. Un admin, qui a le droit de faire grandir la liste partagée,
 * garde la saisie libre.
 */
export function resolveCreatable(creatable: boolean, saveNewValue: boolean, isAdmin: boolean): boolean {
  return creatable && (!saveNewValue || isAdmin);
}
