/**
 * Egalite d'ENSEMBLES de chaines — pure, partagee par les diffs de formulaire.
 *
 * Assignes, etiquettes et tags sont des ensembles : les reordonner n'est pas
 * les modifier, et l'envoyer au serveur journaliserait une modification vide.
 * Une seule implementation, utilisee par la modale de carte pour les trois.
 */
export function sameStringSet(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) return false;
  const reference = new Set(right);
  return left.every((value) => reference.has(value));
}
