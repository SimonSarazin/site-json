/**
 * Filtrage "fuzzy" volontairement simple : chaque token de la requête doit être
 * une sous-chaîne du texte (insensible à la casse). Suffisant pour < 1000
 * commandes ; pas de dépendance (cf. RFC § 3.4 / § 11.2.3).
 */
export function matchText(text: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = text.toLowerCase();
  return q.split(/\s+/).every((token) => haystack.includes(token));
}
