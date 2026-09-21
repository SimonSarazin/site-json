/**
 * Pastille de titre de section — le repère visuel inclinable partagé par `articleTeaser` et
 * `action-tiles` (`headlineStyle: "badge"`) : une page qui alterne des bandes peut ainsi porter le MÊME
 * repère partout. Recopiée, la classe divergeait au premier ajustement.
 *
 * `map-bubbles` et `featured-carousel` gardent la leur : leurs tailles suivent la largeur de la carte
 * (`@container`) ou du carrousel, pas celle de la page.
 */
export const SECTION_BADGE_CLASS =
  "rounded-none border-none -rotate-4 px-4 py-1.5 shadow-md text-2xl md:text-3xl font-serif";
