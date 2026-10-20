import { useEffect, useRef, type RefObject } from "react";

/** Après une fermeture, fenêtre pendant laquelle une liste rechargée peut encore retirer la ligne. */
const RETOUR_DIFFERE_MS = 5000;

/**
 * Où rendre le focus : nulle part si un élément encore dans le document l'a déjà ; sinon l'ouvreur
 * s'il y est toujours, sinon le premier repli présent.
 */
export function focusTarget(
  active: Element | null,
  opener: HTMLElement | null,
  fallbacks: readonly (HTMLElement | null)[],
): HTMLElement | null {
  if (active && active !== active.ownerDocument.body && active.isConnected) return null;
  if (opener?.isConnected) return opener;
  return fallbacks.find((el) => el?.isConnected) ?? null;
}

/**
 * Rend le focus à l'élément qui a ouvert une boîte de dialogue (`openerRef`, posé par l'appelant au
 * clic) — ou, s'il a disparu, au premier repli présent (`fallbacks`). Différé et conditionnel : Radix
 * restaure lui-même le focus au démontage ; on ne reprend la main que s'il est perdu.
 *
 * Deux temps, parce que la ligne peut disparaître APRÈS la fermeture : un créneau modifié qui change
 * de groupe quitte sa liste au retour du rechargement, quelques centaines de millisecondes plus tard.
 * `watch` (les données de la liste) relance donc la vérification dans la fenêtre qui suit une
 * fermeture — jamais en dehors, pour ne pas voler le focus plus tard.
 */
export function useReturnFocus(fallbacks: readonly RefObject<HTMLElement | null>[], watch?: unknown) {
  const openerRef = useRef<HTMLElement | null>(null);
  const pendingUntil = useRef(0);
  // Lus au moment de rendre le focus, pas figés à la création de l'effet.
  const fallbacksRef = useRef(fallbacks);
  useEffect(() => {
    fallbacksRef.current = fallbacks;
  });

  const restore = () =>
    focusTarget(document.activeElement, openerRef.current, fallbacksRef.current.map((ref) => ref.current))?.focus();

  const returnFocus = () => {
    pendingUntil.current = Date.now() + RETOUR_DIFFERE_MS;
    window.setTimeout(restore, 0);
  };

  useEffect(() => {
    if (Date.now() > pendingUntil.current) return;
    const cible = focusTarget(document.activeElement, openerRef.current, fallbacksRef.current.map((ref) => ref.current));
    if (!cible) return;
    cible.focus();
    pendingUntil.current = 0;
  }, [watch]);

  return { openerRef, returnFocus };
}
