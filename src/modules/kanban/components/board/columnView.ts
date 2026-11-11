/**
 * Colonne AFFICHEE du tableau — logique PURE (`tests/unit/columnView.test.ts`).
 *
 * Trois decisions de l'interface d'une colonne, sorties du composant pour etre
 * testees sans DOM :
 *  - la FENETRE de cartes rendues (« Afficher N de plus ») : un board-lien porte
 *    toutes les actions visibles du projet (§11.4), 1 009 sur le projet CMS,
 *    dont 880 dans « Terminé ». Les rendre toutes gelait la page plusieurs
 *    secondes a l'ouverture, a chaque frappe dans la recherche et a chaque
 *    glisser ;
 *  - ou rendre le FOCUS quand une carte quitte la colonne (archivage) ;
 *  - de combien DEFILER la liste pour montrer une carte qui vient de naitre a
 *    son rang canonique, loin du composeur.
 */

/** Cartes rendues d'emblee par colonne ; « Afficher N de plus » en ajoute autant. */
export const CARD_WINDOW_SIZE = 50;

/**
 * Identifiants RENDUS d'une colonne : les `limit` premiers, dans l'ordre.
 *
 * `pinnedId` (la carte tenue pendant un glisser) est toujours rendue, meme au-
 * dela de la fenetre — a la suite des autres : sans son noeud, dnd-kit perdrait
 * l'element actif en plein geste. Elle retrouve sa vraie place au depot, ou la
 * fenetre s'elargit jusqu'a elle (`windowLimitCovering`).
 */
export function windowCardIds(
  ids: readonly string[],
  limit: number,
  pinnedId: string | null = null,
): readonly string[] {
  if (ids.length <= limit) {
    return ids;
  }
  const visible = ids.slice(0, Math.max(0, limit));
  if (pinnedId !== null && !visible.includes(pinnedId) && ids.includes(pinnedId)) visible.push(pinnedId);
  return visible;
}

/** Fenetre courante d'une colonne : celle qu'on a elargie, sinon la fenetre par defaut. */
export function windowLimitOf(limits: Readonly<Record<string, number>>, columnId: string): number {
  return Object.prototype.hasOwnProperty.call(limits, columnId) ? limits[columnId] : CARD_WINDOW_SIZE;
}

/** Nombre de cartes que le bouton « Afficher N de plus » ajoutera. */
export function showMoreCount(total: number, limit: number): number {
  return Math.max(0, Math.min(CARD_WINDOW_SIZE, total - limit));
}

/**
 * Fenetre minimale qui montre la carte d'index `index` : multiple de la taille
 * de fenetre, jamais plus petite que la fenetre courante.
 */
export function windowLimitCovering(index: number, current: number): number {
  if (index < current) return current;
  return Math.ceil((index + 1) / CARD_WINDOW_SIZE) * CARD_WINDOW_SIZE;
}

/**
 * Cible d'un depot sur la ZONE d'une colonne (pas sur une carte), au depot
 * comme pendant le survol.
 *
 * Sans carte survolee, `moveCardInOrder` place la carte a la FIN de la colonne.
 * Sur une colonne tronquee, cette fin est cachee sous « Afficher N de plus » :
 * la carte lachee disparaissait. Elle se place donc apres la derniere carte
 * AFFICHEE — la ou l'on vient de la lacher.
 */
export function zoneDropTarget(
  ids: readonly string[],
  limit: number,
): { overCardId?: string; placeAfter?: boolean } {
  if (ids.length <= limit || limit <= 0) return {};
  return { overCardId: ids[limit - 1], placeAfter: true };
}

/**
 * Carte qui recoit le focus quand `removedId` quitte la colonne : la suivante,
 * sinon la precedente, sinon `null` (l'appelant se rabat sur une commande de la
 * colonne). Sans cela, le focus tombait sur `<body>` avec le bouton qui
 * l'avait, et la navigation clavier repartait du haut de la page.
 */
export function focusTargetAfterRemoval(ids: readonly string[], removedId: string): string | null {
  const index = ids.indexOf(removedId);
  if (index === -1) return null;
  return ids[index + 1] ?? ids[index - 1] ?? null;
}

export interface RevealGeometry {
  /** Haut de l'element, dans le repere du contenu defilant. */
  itemTop: number;
  itemHeight: number;
  /** `scrollTop` courant et hauteur visible du conteneur. */
  scrollTop: number;
  viewHeight: number;
  /** Marge gardee autour de l'element (anneau de focus, respiration). */
  margin?: number;
}

/**
 * `scrollTop` qui amene l'element dans la vue du conteneur, ou `null` s'il y
 * est deja. Le defilement reste celui de la LISTE : `scrollIntoView` faisait
 * aussi defiler la page, et emportait le composeur hors de l'ecran.
 */
export function scrollTopToReveal({ itemTop, itemHeight, scrollTop, viewHeight, margin = 8 }: RevealGeometry): number | null {
  if (itemTop - margin < scrollTop) return Math.max(0, itemTop - margin);
  const bottom = itemTop + itemHeight + margin;
  if (bottom > scrollTop + viewHeight) return Math.max(0, bottom - viewHeight);
  return null;
}
