/**
 * Pastille de titre de section — le repère visuel inclinable partagé par `articleTeaser` et
 * `action-tiles` (`headlineStyle: "badge"`) : une page qui alterne des bandes peut ainsi porter le MÊME
 * repère partout. Recopiée, la classe divergeait au premier ajustement.
 *
 * `map-bubbles` et `featured-carousel` gardent la leur : leurs tailles suivent la largeur de la carte
 * (`@container`) ou du carrousel, pas celle de la page.
 */
const SECTION_BADGE_CLASS =
  "rounded-none border-none -rotate-4 px-4 py-1.5 shadow-md text-2xl md:text-3xl font-serif";

/**
 * Variante PILULE : arrondie, droite, posée en haut d'une carte (et débordant de son bord quand la
 * section la place ainsi). Même repère, lecture plus calme sur une page qui empile des cartes.
 */
const SECTION_BADGE_PILL_CLASS =
  "rounded-full border-none px-5 py-2 shadow-md text-lg md:text-xl font-serif";

/** Classe de la pastille de titre d'une section, selon sa forme (`headlineStyle`) — `badge` par défaut. */
export function sectionBadgeClass(headlineStyle?: string): string {
  return headlineStyle === "pill" ? SECTION_BADGE_PILL_CLASS : SECTION_BADGE_CLASS;
}
