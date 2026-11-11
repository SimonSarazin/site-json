/**
 * Minuscules a l'identique de `mb_strtolower($value, 'UTF-8')` en PHP 7.4 —
 * pure, testee par `tests/unit/phpLowercase.test.ts`.
 *
 * Pourquoi ce n'est pas `toLowerCase()` tout court : JavaScript applique la
 * regle CONTEXTUELLE du sigma final (« Σ » en fin de mot devient « ς »), PHP 7.4
 * non (« Σ » devient toujours « σ » ; la regle n'arrive qu'en PHP 8.3). Or deux
 * calculs doivent donner le meme resultat des deux cotes :
 *  - la couleur d'une etiquette, hachee sur le nom en minuscules
 *    (`ActionCards::labelColor`) : « ΚΟΣΜΟΣ » tombait sur deux teintes ;
 *  - la comparaison des tags dans la fusion de `card/update` (`cardMerge.ts`).
 *
 * Remplacer « Σ » AVANT la mise en minuscules reproduit PHP sans toucher aux
 * « ς » deja saisis en minuscules, que PHP conserve tels quels — remplacer
 * « ς » APRES casserait ce second cas.
 *
 * Module SANS import : `cardMerge.ts` l'importe (cf. son en-tete).
 */
export function phpLowercase(value: string): string {
  return value.replace(/Σ/g, 'σ').toLowerCase();
}
