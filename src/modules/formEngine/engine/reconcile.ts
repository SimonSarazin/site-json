/**
 * Helpers de DIFF / EFFACEMENT mutualisés des chemins d'édition (cf. doc/refactor-field-treatment.md, P0).
 * Première brique du futur pipeline de champ unifié (`reconcile`) : centralise (a) l'égalité de valeurs et
 * (b) la détection des champs VIDÉS — qui était dupliquée à la main (useEditTiersLieu) et absente ailleurs.
 */

/** Égalité de valeurs (objet/array/scalaire) pour les diffs d'édition — JSON-stable, `null` ≡ `undefined`. */
export const isSameValue = (a: unknown, b: unknown): boolean =>
  JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/**
 * Valeur « vide » à envoyer pour EFFACER un champ, reconnue par le SDK costum (`_saveCostumViaElementSave` :
 * `null` / `""` / `[]` → `""` → backend `prepElementData` → `$unset`).
 * ⚠ JAMAIS `{}` pour un objet : `{}` n'est PAS un clear (le backend MERGE l'objet → no-op) ; on émet `""`
 * (que les parsers de lecture filtrent, ex. `parseSocialLinks`). Array → `[]` (reconnu comme clear par le SDK).
 */
const emptyFor = (prev: unknown): unknown => (Array.isArray(prev) ? [] : "");

/**
 * Champs EFFACÉS dans un payload d'édition COMPLET (qui omet les champs vides — ex. `buildTiersLieuxPayload`
 * via spreads conditionnels). Toute clé présente dans `baseline` (payload reconstruit depuis l'entité serveur)
 * mais ABSENTE de `payload` = champ que l'utilisateur a vidé → on émet une valeur vide TYPÉE pour l'effacer
 * explicitement (sinon le draft garde l'ancienne valeur → `save()` ne voit aucun changement → pas d'appel).
 *
 * ⚠ À n'utiliser QUE sur un payload COMPLET. Sur un payload PARTIEL (diff, ex. `buildEditPatch`), une clé
 * absente = champ INCHANGÉ (et non effacé) → ce helper effacerait à tort les champs non modifiés.
 *
 * @param skip clés à NE PAS réconcilier ici (traitées à part) : ex. `"address"` (atomique), `"tags"` (mergés).
 * @returns un objet `{ clé: vide }` à appliquer au draft (vide seulement, ne contient pas les champs modifiés).
 */
export function reconcileClearedFields(
  payload: Record<string, unknown>,
  baseline: Record<string, unknown>,
  opts: { skip?: readonly string[] } = {},
): Record<string, unknown> {
  const skip = new Set(opts.skip ?? []);
  const cleared: Record<string, unknown> = {};
  for (const key of Object.keys(baseline)) {
    if (key in payload || skip.has(key)) continue;
    cleared[key] = emptyFor(baseline[key]);
  }
  return cleared;
}
