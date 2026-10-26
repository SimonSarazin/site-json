/**
 * Amène une section de la page ampli à l'écran, et y pose le focus clavier.
 *
 * Impératif (hors cycle de rendu) : le hero et sa cible sont deux sections
 * sœurs, aucune n'a de ref sur l'autre — on résout par ancre DOM
 * (`AMPLI_SECTION_IDS`).
 */

/** Premier élément réellement utilisable de la section (champ de formulaire,
 *  bouton…) : le focus doit atterrir sur ce que l'utilisateur venait faire. */
const FOCUSABLE = 'input,textarea,select,button,[tabindex]:not([tabindex="-1"])';

export interface ScrollToSectionOptions {
  /** Poser le focus sur le premier élément interactif de la section. */
  focus?: boolean;
}

export function scrollToSection(id: string, { focus = false }: ScrollToSectionOptions = {}): void {
  if (typeof document === "undefined" || typeof window === "undefined") return;

  const target = document.getElementById(id);
  if (!target) return;

  // `html { scroll-behavior: smooth }` est global mais ne consulte PAS la
  // préférence système : on tranche ici pour ne pas imposer d'animation à qui
  // demande moins de mouvement.
  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  target.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });

  if (!focus) return;
  // `preventScroll` : le focus ne doit pas court-circuiter le défilement doux
  // qu'on vient de lancer. Rien à focaliser (chunk du formulaire pas encore
  // chargé, section vide) → le défilement seul suffit.
  target.querySelector<HTMLElement>(FOCUSABLE)?.focus({ preventScroll: true });
}
