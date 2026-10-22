/**
 * Ce que jsdom ne sait pas faire et que l'éditeur demande.
 *
 * Quand il prend le focus, l'éditeur fait défiler sa sélection à l'écran, et la mesure pour cela
 * (`Range.getClientRects`). jsdom ne met rien en page et n'a pas ces deux méthodes : sans leurs
 * doublures, chaque prise de focus lèverait HORS du test — une erreur « non interceptée » qui ne
 * dit pas d'où elle vient.
 *
 * À appeler en tête d'un fichier de test qui monte un composer avec son éditeur.
 */
export function stubSelectionGeometry(): void {
  const rien = { x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, toJSON: () => ({}) };
  if (typeof Range.prototype.getClientRects !== "function") {
    Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
  }
  if (typeof Range.prototype.getBoundingClientRect !== "function") {
    Range.prototype.getBoundingClientRect = () => rien as DOMRect;
  }
}
