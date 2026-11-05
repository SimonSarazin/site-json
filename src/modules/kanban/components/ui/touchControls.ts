import type { TouchEvent } from 'react';

/**
 * Arrete le `touchstart` au conteneur des commandes d'une fiche saisissable
 * (menu « ⋯ », archivage, retrait de role) SEULEMENT si le doigt est
 * reellement dessus.
 *
 * POURQUOI ne pas tout arreter : le navigateur « aimante » un appui tactile
 * vers la commande la plus proche (ajustement tactile de Chrome : a une
 * quinzaine de pixels du menu « ⋯ », l'evenement lui est attribue). Arreter
 * chaque `touchstart` venu des commandes privait donc de saisie toute une bande
 * de la fiche autour d'elles, le portrait et la fin du titre compris. Le point
 * touche, lui, ne ment pas : hors du conteneur, l'appui revient a la fiche.
 */
export function stopTouchOnControls(event: TouchEvent<HTMLElement>): void {
  const touch = event.touches[0];
  const doc = event.currentTarget.ownerDocument;
  const hit =
    touch !== undefined && typeof doc.elementFromPoint === 'function'
      ? doc.elementFromPoint(touch.clientX, touch.clientY)
      : null;
  // Sans point lisible, la regle sure : la commande garde son geste.
  if (hit !== null && !event.currentTarget.contains(hit)) return;
  event.stopPropagation();
}
