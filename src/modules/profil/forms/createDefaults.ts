/**
 * Semis de valeurs dans une modale de CRÉATION — moteur de `admin.tabs[].sections[].createDefaults`
 * (le POURQUOI de la clé est documenté sur le schéma, `modules/admin/schema.ts`, et dans doc/30).
 * Module PUR (aucun React), appelé par `EntityFormModal` juste après `buildDefaults`.
 */

/**
 * Fusionne `seed` par-dessus `defaults`, restreint aux champs déclarés par le formulaire.
 *
 * Deux choix non évidents :
 * - **filtrage sur `knownFields`** : une clé inconnue resterait dans l'état react-hook-form sans
 *   jamais être rendue ni sérialisée (le pipeline d'écriture projette par le descripteur) — une
 *   faute de frappe en config donnerait un semis silencieusement mort. L'écarter rend le cas inerte
 *   explicitement ;
 * - **retour PAR IDENTITÉ** quand rien ne s'applique : les appelants mémoïsent sur cette référence,
 *   et « un formulaire sans `createDefaults` est intouché » devient prouvable par `toBe`.
 *
 * `undefined` est écarté — semer `undefined` écraserait un défaut légitime par « rien ».
 */
export function applyCreateDefaults<T extends Record<string, unknown>>(
  defaults: T,
  seed: Record<string, unknown> | undefined,
  knownFields: readonly string[],
): T {
  if (!seed) return defaults;
  const champs = new Set(knownFields);
  const retenus = Object.entries(seed).filter(([k, v]) => v !== undefined && champs.has(k));
  return retenus.length === 0 ? defaults : { ...defaults, ...Object.fromEntries(retenus) };
}
