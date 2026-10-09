import type { CSSProperties } from "react";

/**
 * Style d'un élément d'ACCENT (pastille de titre, bouton) d'une section qui pilote sa couleur par config :
 * `accentColor` en fond, `accentTextColor` en encre. `undefined` sans accent — l'élément garde alors son
 * variant de thème.
 *
 * L'encre vaut blanc par défaut, le comportement historique. Elle DOIT être fournie dès que l'accent est
 * clair : blanc sur la turquoise de parent62 (#4ecdc4) ne tient que 1,93:1, quand son marine y tient 5,68:1.
 */
export function accentStyle(accentColor?: string, accentTextColor?: string): CSSProperties | undefined {
  if (!accentColor?.trim()) return undefined;
  return { backgroundColor: accentColor, color: accentTextColor?.trim() || "#fff" };
}
