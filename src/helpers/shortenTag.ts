/**
 * Tronque un tag long en gardant `début…fin` (ex. `"Développement…durable"`). Source unique des cards
 * de recherche (était dupliquée à l'identique dans CardDefault/CardDetailedDefault, seul le défaut
 * `maxLength` variait — passé explicitement au call-site). cf. cartographie-fonctions.
 */
export function shortenTag(tag: string, maxLength = 18): string {
  if (tag.length <= maxLength) return tag;
  const sliceLen = Math.floor((maxLength - 1) / 2);
  return `${tag.slice(0, sliceLen)}…${tag.slice(-sliceLen)}`;
}
