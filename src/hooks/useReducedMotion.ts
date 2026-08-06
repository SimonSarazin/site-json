import { useSyncExternalStore } from "react";

/**
 * Deux gardes de mouvement, partagées par les composants qui font défiler tout seuls
 * (`TestimonialsSection`, `HeroCarousel`).
 *
 * Extraites le 2026-07-30, au moment où un SECOND composant en a eu besoin : le patron
 * est court mais subtil, et le recopier revenait à recopier aussi les deux pièges
 * ci-dessous — qu'un relecteur n'aurait aucune raison de soupçonner.
 *
 * ── Pourquoi `useSyncExternalStore` et pas `useEffect` + `setState` ──
 * `matchMedia` et `document.hidden` sont des sources EXTERNES : c'est la primitive
 * prévue pour s'y abonner. Elle évite le `setState` synchrone dans un effet — que
 * `react-hooks/set-state-in-effect` classe en ERROR dans ce dépôt (`eslint.config.js:36`,
 * preset `recommended` d'eslint-plugin-react-hooks 7) — et fournit un instantané serveur
 * explicite, indispensable puisque les héros sont rendus en SSR.
 *
 * ── ⚠ Piège 1 : `subscribe`/`getSnapshot` DOIVENT être au niveau module ──
 * React compare `subscribe` par IDENTITÉ et se désabonne/réabonne dès qu'elle change.
 * Définies dans le corps du hook, elles seraient neuves à chaque rendu — donc un
 * removeEventListener + addEventListener à CHAQUE tour de rotation, ce qui est
 * exactement ce que cette primitive existe pour éviter.
 *
 * ── ⚠ Piège 2 : le 3ᵉ argument n'est pas facultatif ──
 * `getServerSnapshot` (ici `getFalse`) fixe la valeur au rendu serveur. Sans lui,
 * `useSyncExternalStore` lève en SSR. En le fixant à `false`, on garantit que le serveur
 * rend l'état « mouvement autorisé, onglet visible » — donc un HTML complet et un index
 * de diapositive à 0, sans divergence d'hydratation.
 *
 * ── Ce que ces gardes NE remplacent PAS ──
 * Le plancher CSS de `styles/shared.css` ne nomme que des classes d'animation : il
 * n'arrêtera JAMAIS un `setInterval`. Les deux mécanismes sont complémentaires, pas
 * redondants.
 */

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

const mediaQuery = () =>
  typeof window === "undefined" ? null : window.matchMedia?.(REDUCED_MOTION) ?? null;

function subscribeReducedMotion(onChange: () => void) {
  const mq = mediaQuery();
  if (!mq) return () => {};
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}
const getReducedMotion = () => mediaQuery()?.matches ?? false;

function subscribeVisibility(onChange: () => void) {
  document.addEventListener("visibilitychange", onChange);
  return () => document.removeEventListener("visibilitychange", onChange);
}
const getDocumentHidden = () => document.hidden;

/** Instantané SSR commun aux deux hooks — cf. « Piège 2 » ci-dessus. */
const getFalse = () => false;

/** `true` si la personne a demandé moins d'animation. `false` en SSR. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribeReducedMotion, getReducedMotion, getFalse);
}

/** `true` si l'onglet est en arrière-plan — inutile de faire tourner l'invisible. */
export function useDocumentHidden(): boolean {
  return useSyncExternalStore(subscribeVisibility, getDocumentHidden, getFalse);
}
