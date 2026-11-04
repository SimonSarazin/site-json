/**
 * Initiales d'un nom — pure, partagee par les portraits (`Avatar`) et les
 * vignettes de projet du selecteur.
 *
 * Deux initiales au maximum, prises sur les deux premiers mots : les prenoms
 * composes et les noms d'organisation restent lisibles ainsi. `[...mot][0]`
 * plutot que `mot[0]` : une lettre hors du plan de base (emoji, certains
 * ideogrammes) occupe deux unites UTF-16, et la couper afficherait un
 * caractere casse.
 */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  const letters = words.slice(0, 2).map((word) => [...word][0] ?? '');
  return letters.join('').toLocaleUpperCase();
}
