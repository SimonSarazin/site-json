/**
 * Le NOM d'un bouton qui ouvre l'espace — ce qui lui rend le focus quand la modale se ferme. Une page
 * a plusieurs boutons vers le même espace (le sien, ceux des paliers, ceux des questions) : le
 * lanceur retient celui d'où l'on a ouvert (`useSpaceLauncher`), l'hôte le retrouve à la fermeture.
 */
export const OPENER_ATTRIBUTE = "data-discussion-opener";

/**
 * Le bouton qui porte ce nom, s'il est encore à l'écran. Comparé en valeur, sans sélecteur : un nom
 * relu de l'historique n'a pas à être échappé pour être cherché.
 */
export function findOpener(name: string | null): HTMLElement | null {
  if (name === null) return null;
  for (const element of Array.from(document.querySelectorAll<HTMLElement>(`[${OPENER_ATTRIBUTE}]`))) {
    if (element.getAttribute(OPENER_ATTRIBUTE) === name) return element;
  }
  return null;
}
