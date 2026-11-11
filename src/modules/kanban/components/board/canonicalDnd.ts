/**
 * Glisser-deposer d'un board-lien Communecter : l'ordre est CANONIQUE
 * (blueprint D16) — logique PURE, testee (`tests/unit/canonicalDnd.test.ts`).
 *
 * Dans une colonne, les actions se rangent par priorite puis par date de
 * creation ; Kanban gestion ne persiste aucun ordre manuel. L'apercu du glisser
 * doit donc dire la verite des le survol :
 *  - dans SA colonne, la carte ne bouge pas (aucun decalage des voisines : un
 *    depot y reviendrait a sa place) ;
 *  - dans une AUTRE colonne, elle apparait directement a son rang canonique,
 *    la ou le serveur va la ranger — pas sous le pointeur, ou elle sauterait
 *    au lacher.
 *
 * La regle du serveur (rang) n'est pas recalculee ici : on recoit `rankOf`,
 * qui lit le rang deja canonique de l'instantane (`applyCanonicalRanks`).
 */
import { columnOfCard, moveCardInOrder, type CardDropTarget, type CardOrder } from './kanbanDnd';

/** L'ordre des cartes de ce tableau est-il canonique (aucun reordonnancement manuel) ? */
export function hasCanonicalOrder(source: string): boolean {
  return source === 'communecter';
}

/** Regle d'ordre du tableau : canonique (board-lien) ou manuelle (board kanban). */
export interface CardDropMode {
  canonical: boolean;
  /** Rang d'une carte, lu sur l'instantane (utile au seul mode canonique). */
  rankOf: (cardId: string) => number;
}

/**
 * Ordre affiche si `cardId` etait lache sur `target` — LA projection unique du
 * glisser-deposer.
 *
 * L'apercu (`onDragOver`), le depot (`onDragEnd`) et les ANNONCES du lecteur
 * d'ecran l'appellent tous trois : les annonces calculaient leur propre rang
 * (la carte sous le pointeur), si bien que sur un board-lien on annoncait
 * « deposee en position 3 sur 4 » pour une carte restee premiere. Board-lien :
 * rang canonique (`moveCardToCanonicalSlot`, la cible ne compte que par sa
 * colonne) ; board kanban : la carte survolee et le cote franchi.
 */
export function projectCardDrop(
  order: CardOrder,
  cardId: string,
  target: CardDropTarget,
  mode: CardDropMode,
): CardOrder {
  return mode.canonical
    ? moveCardToCanonicalSlot(order, cardId, target.columnId, mode.rankOf)
    : moveCardInOrder(order, cardId, target);
}

/**
 * La carte revient-elle dans sa colonne d'ORIGINE d'un ordre canonique ? Elle
 * n'y change alors pas de place : l'annonce doit le dire au lieu de promettre
 * un rang (et le depot n'envoie rien).
 */
export function staysInCanonicalColumn(canonical: boolean, originColumnId: string, toColumnId: string): boolean {
  return canonical && originColumnId === toColumnId;
}

/**
 * Ordre affiche si `cardId` etait depose dans `toColumnId` d'un board-lien.
 *
 * Renvoie **la meme reference** quand rien ne bouge (meme colonne, carte ou
 * colonne inconnue) : l'appelant compare par identite pour ne pas rerendre le
 * tableau a chaque frame du glisser.
 */
export function moveCardToCanonicalSlot(
  order: CardOrder,
  cardId: string,
  toColumnId: string,
  rankOf: (cardId: string) => number,
): CardOrder {
  const fromColumnId = columnOfCard(order, cardId);
  if (fromColumnId === null || fromColumnId === toColumnId) return order;
  if (!Object.prototype.hasOwnProperty.call(order, toColumnId)) return order;

  const rank = rankOf(cardId);
  const siblings = order[toColumnId].filter((id) => id !== cardId);
  // Premiere voisine classee APRES la carte : elle s'insere juste devant. A
  // rang egal (impossible en pratique, le departage est dans le rang), la
  // carte deplacee passe derriere, comme une arrivee.
  const index = siblings.findIndex((id) => rankOf(id) > rank);
  const insertAt = index === -1 ? siblings.length : index;

  return {
    ...order,
    [fromColumnId]: order[fromColumnId].filter((id) => id !== cardId),
    [toColumnId]: [...siblings.slice(0, insertAt), cardId, ...siblings.slice(insertAt)],
  };
}
