/*
 * Helpers PURS de l'UI du board.
 *
 * Tout ce qui se calcule sans React vit ici, pour deux raisons :
 *  - le blueprint §8 impose que la logique pure sorte des composants dans un
 *    `.ts` teste (cf. `src/tests/unit/kanbanDnd.test.ts`) ;
 *  - le drag & drop doit produire exactement la meme decision au pointeur, au
 *    clavier et dans le menu « Deplacer vers… ». Une seule implementation,
 *    trois appelants.
 *
 * Regle de contrat (blueprint §1 D9) : le client n'envoie JAMAIS un rang, il
 * envoie une INTENTION (`beforeCardId` / `afterCardId`). Le serveur arbitre le
 * rang fractionnaire et peut renumeroter. Ces helpers ne calculent donc que des
 * voisins, jamais un `rank`.
 */
// Import de TYPE seulement : ce module reste pur, il ne tire aucun code de dnd-kit.
import type { DraggableSyntheticListeners } from '@dnd-kit/core';
import { isTranslatableColumnKey } from '@/modules/kanban/lib/boardSource';
import { isHexColor } from '@/modules/kanban/lib/colors';
import { sortByRank, type Ranked } from '@/modules/kanban/lib/rank';

/** Forme minimale d'une colonne pour les helpers (evite de dependre de `types/kanban`). */
export interface ColumnLike {
  _id: string;
}

/** Forme minimale d'une carte pour les helpers. */
export interface CardLike extends Ranked {
  columnId: string;
}

/** Ordre affiche : pour chaque colonne, la suite ordonnee des ids de cartes. */
export type CardOrder = Readonly<Record<string, readonly string[]>>;

/** Corps de `card/move` : une INTENTION de placement, jamais un rang (D9). */
export interface CardMoveRequest {
  cardId: string;
  columnId: string;
  beforeCardId?: string;
  afterCardId?: string;
}

/**
 * Ce que designent les colonnes d'un tableau : un STATUT (Tableau) ou un JALON (vue Jalons). Les
 * mots de « Déplacer vers… » en dependent ; la mecanique est la meme.
 */
export type CardMoveTarget = 'column' | 'milestone';

/** Corps de `column/move` : une intention de placement, jamais un rang. */
export interface ColumnMoveRequest {
  columnId: string;
  beforeColumnId?: string;
  afterColumnId?: string;
}

/* ------------------------------------------------------------------ */
/*  Indexation                                                          */
/* ------------------------------------------------------------------ */

/**
 * Construit l'ordre affiche a partir du snapshot serveur.
 * Toutes les colonnes sont presentes, y compris les vides : sans cela, une
 * colonne vide n'aurait pas de zone de depot.
 */
export function buildCardOrder(
  columns: readonly ColumnLike[],
  cards: readonly CardLike[],
): CardOrder {
  const order: Record<string, string[]> = {};
  for (const column of columns) order[column._id] = [];
  for (const card of sortByRank(cards)) {
    const bucket = order[card.columnId];
    // Une carte dont la colonne a disparu (course avec une suppression) est
    // ignoree plutot que de creer une colonne fantome.
    if (bucket) bucket.push(card._id);
  }
  return order;
}

/**
 * Ordre `next` dans lequel chaque colonne INCHANGEE reprend le tableau de
 * `previous` ; `previous` lui-meme si aucune colonne n'a change.
 *
 * Pourquoi : `buildCardOrder` recree un tableau par colonne a chaque appel. Or
 * le `SortableContext` de dnd-kit compare ses `items` par REFERENCE : un
 * tableau neuf, meme identique, fait se rendre de nouveau toutes les cartes de
 * la colonne. Une frappe dans la recherche qui ne change qu'une colonne — ou
 * aucune (une espace de plus) — rendait tout le tableau.
 */
export function reuseUnchangedColumns(previous: CardOrder, next: CardOrder): CardOrder {
  if (previous === next) return previous;
  const merged: Record<string, readonly string[]> = {};
  let changed = Object.keys(previous).length !== Object.keys(next).length;
  for (const [columnId, ids] of Object.entries(next)) {
    const before = Object.prototype.hasOwnProperty.call(previous, columnId) ? previous[columnId] : undefined;
    if (before !== undefined && sameSequence(before, ids)) {
      merged[columnId] = before;
    } else {
      merged[columnId] = ids;
      changed = true;
    }
  }
  return changed ? merged : previous;
}

/** Colonne qui contient la carte dans cet ordre, `null` si elle n'y est pas. */
export function columnOfCard(order: CardOrder, cardId: string): string | null {
  for (const [columnId, ids] of Object.entries(order)) {
    if (ids.includes(cardId)) return columnId;
  }
  return null;
}

/** Position (1-based) d'une carte dans sa colonne — sert aux annonces ARIA. */
export function cardPosition(
  order: CardOrder,
  cardId: string,
): { columnId: string; position: number; total: number } | null {
  const columnId = columnOfCard(order, cardId);
  if (columnId === null) return null;
  const ids = order[columnId];
  return { columnId, position: ids.indexOf(cardId) + 1, total: ids.length };
}

/** Position (1-based) d'une colonne dans le board. */
export function columnPosition(
  columnIds: readonly string[],
  columnId: string,
): { position: number; total: number } | null {
  const index = columnIds.indexOf(columnId);
  if (index === -1) return null;
  return { position: index + 1, total: columnIds.length };
}

/* ------------------------------------------------------------------ */
/*  Identifiants dnd-kit                                                */
/* ------------------------------------------------------------------ */

/*
 * Cartes, colonnes et zones de depot cohabitent dans le meme `DndContext` :
 * leurs identifiants sont prefixes pour qu'aucune collision ne soit possible,
 * meme si un jour un id de colonne ressemblait a un id de carte.
 */
export const CARD_ID_PREFIX = 'card:';
export const COLUMN_ID_PREFIX = 'column:';
export const ZONE_ID_PREFIX = 'zone:';

export function cardSortableId(cardId: string): string {
  return `${CARD_ID_PREFIX}${cardId}`;
}

export function columnSortableId(columnId: string): string {
  return `${COLUMN_ID_PREFIX}${columnId}`;
}

export function columnZoneId(columnId: string): string {
  return `${ZONE_ID_PREFIX}${columnId}`;
}

/* ------------------------------------------------------------------ */
/*  Donnees portees par les draggables                                  */
/* ------------------------------------------------------------------ */

export interface CardDragData {
  type: 'card';
  cardId: string;
  columnId: string;
}

export interface ColumnDragData {
  type: 'column';
  columnId: string;
}

export type BoardDragData = CardDragData | ColumnDragData;

/*
 * dnd-kit type `data.current` en `Record<string, any>` : ces gardes evitent le
 * `as` que le guide de bonnes pratiques proscrit.
 */
export function isCardDragData(value: unknown): value is CardDragData {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<CardDragData>;
  return (
    candidate.type === 'card' &&
    typeof candidate.cardId === 'string' &&
    typeof candidate.columnId === 'string'
  );
}

export function isColumnDragData(value: unknown): value is ColumnDragData {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<ColumnDragData>;
  return candidate.type === 'column' && typeof candidate.columnId === 'string';
}

/**
 * Colonne visee par un survol, quel que soit ce qui est survole : une carte
 * designe sa propre colonne, une colonne (ou sa zone de depot) se designe
 * elle-meme.
 */
export function targetColumnOf(data: unknown): string | null {
  if (isCardDragData(data)) return data.columnId;
  if (isColumnDragData(data)) return data.columnId;
  return null;
}

/** Carte survolee, ou `null` si le survol porte sur une colonne. */
export function targetCardOf(data: unknown): string | null {
  return isCardDragData(data) ? data.cardId : null;
}

type DragListenerMap = NonNullable<DraggableSyntheticListeners>;

/**
 * Ecouteurs de saisie de dnd-kit, separes en POINTEUR et CLAVIER.
 *
 * La fiche entiere se saisit a la souris et au doigt, mais la prise CLAVIER
 * est un bouton a part, la poignee : poser le `role="button"` et l'ecouteur de
 * touches sur toute la fiche faisait d'elle un bouton qui englobe un lien et
 * d'autres boutons (enfants presentationnels en ARIA). Les ecouteurs clavier
 * (`onKey*`, ceux du `KeyboardSensor`) vont donc a la poignee, tous les autres
 * (`onMouseDown`, `onTouchStart`…) a la fiche.
 */
export function splitDragListeners(listeners: DraggableSyntheticListeners): {
  pointer: DragListenerMap;
  keyboard: DragListenerMap;
} {
  const pointer: DragListenerMap = {};
  const keyboard: DragListenerMap = {};
  for (const [name, handler] of Object.entries(listeners ?? {})) {
    if (name.startsWith('onKey')) keyboard[name] = handler;
    else pointer[name] = handler;
  }
  return { pointer, keyboard };
}

/* ------------------------------------------------------------------ */
/*  Deplacement d'une carte                                             */
/* ------------------------------------------------------------------ */

export interface CardDropTarget {
  columnId: string;
  /** Carte survolee, si le depot vise une carte precise. */
  overCardId?: string;
  /**
   * Vrai quand le pointeur a depasse le bas de la carte survolee : on insere
   * APRES elle. Ignore dans la colonne d'origine, ou la direction du geste
   * fait foi (c'est ce que dessine la strategie de tri de dnd-kit).
   */
  placeAfter?: boolean;
}

function sameSequence(a: readonly string[], b: readonly string[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  return a.every((value, index) => value === b[index]);
}

/**
 * Ordre resultant si `cardId` etait depose sur `target`.
 *
 * Renvoie **la meme reference** quand rien ne bouge : l'appelant peut donc
 * comparer par identite pour ne pas declencher de rendu a chaque frame de drag.
 */
export function moveCardInOrder(
  order: CardOrder,
  cardId: string,
  target: CardDropTarget,
): CardOrder {
  const fromColumnId = columnOfCard(order, cardId);
  if (fromColumnId === null) return order;
  /*
   * Survoler LA CARTE DEPLACEE elle-meme n'est jamais un deplacement — quelle
   * que soit la colonne annoncee par la cible.
   *
   * La cible est construite a partir des donnees du draggable survole, qui
   * portent la colonne d'ORIGINE de la carte. Des qu'on la glisse dans une
   * autre colonne, l'ordre optimiste l'a deja relogee : la cible annonce alors
   * `fromColumnId !== toColumnId` et la carte etait reinseree en bas de sa
   * colonne de depart, faux deplacement aussitot persiste au depot. Conditionner
   * ce test a l'egalite des colonnes rouvrait donc exactement ce bug.
   */
  if (target.overCardId === cardId) return order;
  const toColumnId = target.columnId;
  if (!Object.prototype.hasOwnProperty.call(order, toColumnId)) return order;

  const source = order[fromColumnId];
  const destination = order[toColumnId];
  const siblings = destination.filter((id) => id !== cardId);

  let insertAt = siblings.length;
  if (target.overCardId !== undefined) {
    const overIndex = siblings.indexOf(target.overCardId);
    if (overIndex !== -1) {
      const after =
        fromColumnId === toColumnId
          ? source.indexOf(cardId) < source.indexOf(target.overCardId)
          : (target.placeAfter ?? false);
      insertAt = after ? overIndex + 1 : overIndex;
    }
  }

  const nextDestination = [...siblings.slice(0, insertAt), cardId, ...siblings.slice(insertAt)];

  if (fromColumnId === toColumnId) {
    if (sameSequence(nextDestination, source)) return order;
    return { ...order, [toColumnId]: nextDestination };
  }

  return {
    ...order,
    [fromColumnId]: source.filter((id) => id !== cardId),
    [toColumnId]: nextDestination,
  };
}

/**
 * Traduit une position deja calculee en intention pour `card/move`.
 *
 * `afterCardId` est prefere a `beforeCardId` : ancrer la carte sur son voisin
 * du dessus donne au serveur le meme resultat, et une seule des deux cles
 * suffit (cf. `place()` cote backend).
 */
export function cardMoveRequest(order: CardOrder, cardId: string): CardMoveRequest | null {
  const columnId = columnOfCard(order, cardId);
  if (columnId === null) return null;
  const ids = order[columnId];
  const index = ids.indexOf(cardId);
  if (index > 0) return { cardId, columnId, afterCardId: ids[index - 1] };
  if (index === 0 && ids.length > 1) return { cardId, columnId, beforeCardId: ids[1] };
  return { cardId, columnId };
}

/**
 * Cible equivalente a une INTENTION de `card/move` (ancre avant / apres) : c'est
 * ce que projette « Déplacer vers… » pour savoir ou la carte va atterrir — et
 * elargir la fenetre de la colonne si c'est au-dela des cartes affichees.
 */
export function dropTargetOfRequest(request: CardMoveRequest): CardDropTarget {
  if (request.afterCardId !== undefined) {
    return { columnId: request.columnId, overCardId: request.afterCardId, placeAfter: true };
  }
  if (request.beforeCardId !== undefined) {
    return { columnId: request.columnId, overCardId: request.beforeCardId, placeAfter: false };
  }
  return { columnId: request.columnId };
}

/**
 * Ordre optimiste + intention serveur d'un depot de carte.
 * `null` quand le geste ne change rien : aucune requete ne doit partir.
 */
export function planCardMove(
  order: CardOrder,
  cardId: string,
  target: CardDropTarget,
): { order: CardOrder; intent: CardMoveRequest } | null {
  const next = moveCardInOrder(order, cardId, target);
  if (next === order) return null;
  const intent = cardMoveRequest(next, cardId);
  return intent === null ? null : { order: next, intent };
}

/* ------------------------------------------------------------------ */
/*  Deplacement d'une colonne                                           */
/* ------------------------------------------------------------------ */

/** Ordre des colonnes resultant ; meme reference si rien ne bouge. */
export function moveColumnInOrder(
  columnIds: readonly string[],
  columnId: string,
  overColumnId: string,
): readonly string[] {
  const from = columnIds.indexOf(columnId);
  const to = columnIds.indexOf(overColumnId);
  if (from === -1 || to === -1 || from === to) return columnIds;

  const rest = columnIds.filter((id) => id !== columnId);
  const overIndex = rest.indexOf(overColumnId);
  const insertAt = from < to ? overIndex + 1 : overIndex;
  return [...rest.slice(0, insertAt), columnId, ...rest.slice(insertAt)];
}

export function columnMoveRequest(
  columnIds: readonly string[],
  columnId: string,
): ColumnMoveRequest | null {
  const index = columnIds.indexOf(columnId);
  if (index === -1) return null;
  if (index > 0) return { columnId, afterColumnId: columnIds[index - 1] };
  if (columnIds.length > 1) return { columnId, beforeColumnId: columnIds[1] };
  return { columnId };
}

export function planColumnMove(
  columnIds: readonly string[],
  columnId: string,
  overColumnId: string,
): { order: readonly string[]; intent: ColumnMoveRequest } | null {
  const next = moveColumnInOrder(columnIds, columnId, overColumnId);
  if (next === columnIds) return null;
  const intent = columnMoveRequest(next, columnId);
  return intent === null ? null : { order: next, intent };
}

/* ------------------------------------------------------------------ */
/*  Alternative clavier : « Deplacer vers… »                            */
/* ------------------------------------------------------------------ */

/** Emplacement possible d'une carte dans une colonne, du haut vers le bas. */
export interface CardDropSlot {
  /** 0 = en tete de colonne, n = en fin. */
  index: number;
  beforeCardId?: string;
  afterCardId?: string;
  /** Carte qui precedera la carte deplacee, `null` en tete de colonne. */
  previousCardId: string | null;
}

/**
 * Tous les emplacements offerts par une colonne pour une carte donnee.
 *
 * La carte deplacee est retiree de la liste avant le calcul : sinon, dans sa
 * propre colonne, elle s'offrirait comme voisine d'elle-meme et le serveur
 * repondrait `notFound` sur `afterCardId`.
 */
export function listCardDropSlots(
  order: CardOrder,
  columnId: string,
  movingCardId: string,
): CardDropSlot[] {
  if (!Object.prototype.hasOwnProperty.call(order, columnId)) return [];
  const siblings = order[columnId].filter((id) => id !== movingCardId);

  return Array.from({ length: siblings.length + 1 }, (_unused, index) => {
    if (index === 0) {
      return siblings.length === 0
        ? { index, previousCardId: null }
        : { index, beforeCardId: siblings[0], previousCardId: null };
    }
    return { index, afterCardId: siblings[index - 1], previousCardId: siblings[index - 1] };
  });
}

/** Emplacement actuellement occupe, ou la fin de colonne si la carte vient d'ailleurs. */
export function currentCardSlotIndex(
  order: CardOrder,
  columnId: string,
  cardId: string,
): number {
  if (!Object.prototype.hasOwnProperty.call(order, columnId)) return 0;
  const ids = order[columnId];
  const index = ids.indexOf(cardId);
  return index === -1 ? ids.filter((id) => id !== cardId).length : index;
}

/** Traduit un emplacement en intention pour `card/move`. */
export function slotToRequest(
  cardId: string,
  columnId: string,
  slot: CardDropSlot,
): CardMoveRequest {
  return {
    cardId,
    columnId,
    ...(slot.beforeCardId === undefined ? {} : { beforeCardId: slot.beforeCardId }),
    ...(slot.afterCardId === undefined ? {} : { afterCardId: slot.afterCardId }),
  };
}

/* ------------------------------------------------------------------ */
/*  Divers (rendu des cartes)                                           */
/* ------------------------------------------------------------------ */

/**
 * Couleur d'etiquette utilisable dans un attribut `style`, ou `null`.
 *
 * Les etiquettes viennent de la base : leur couleur est une donnee, pas un
 * jeton. On n'accepte qu'un hexadecimal (`isHexColor`, le validateur unique de
 * `lib/colors`), tout le reste retombe sur un jeton chez l'appelant — une
 * valeur libre injectee dans `style` serait une surface d'attaque. Les blancs
 * autour sont toleres : une saisie « #abc » collee avec un espace reste lisible.
 */
export function safeLabelColor(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const color = value.trim();
  return isHexColor(color) ? color : null;
}

/* ------------------------------------------------------------------ */
/*  Index des membres et des etiquettes                                 */
/* ------------------------------------------------------------------ */

export interface CardMember {
  userId: string;
  name: string;
  avatarUrl: string | null;
}

export interface MemberLike {
  userId: string;
  profile?: { name?: string | null; profilThumbImageUrl?: string | null } | null;
}

/**
 * Index des membres par `userId`.
 *
 * Les cartes ne portent que des ids : sans cet index, chaque carte referait un
 * `find()` sur la liste des membres a chaque rendu, pendant le drag compris.
 */
export function indexMembers(members: readonly MemberLike[]): ReadonlyMap<string, CardMember> {
  const index = new Map<string, CardMember>();
  for (const member of members) {
    index.set(member.userId, {
      userId: member.userId,
      // Un membre dont le profil n'est plus lisible reste identifiable : mieux
      // vaut un id qu'un portrait anonyme sur une carte assignee.
      name: member.profile?.name ?? member.userId,
      avatarUrl: member.profile?.profilThumbImageUrl ?? null,
    });
  }
  return index;
}

export interface CardLabel {
  id: string;
  name: string;
  color: string | null;
}

export interface LabelLike {
  id: string;
  name: string;
  color?: string | null;
}

export function indexLabels(labels: readonly LabelLike[]): ReadonlyMap<string, CardLabel> {
  const index = new Map<string, CardLabel>();
  for (const label of labels) {
    index.set(label.id, { id: label.id, name: label.name, color: safeLabelColor(label.color) });
  }
  return index;
}

/* ------------------------------------------------------------------ */
/*  Comparaisons et geometrie du depot                                  */
/* ------------------------------------------------------------------ */

/**
 * Deux intentions decrivent-elles la meme place ?
 *
 * C'est le seul test de « geste blanc » fiable : comparer des ordres ne suffit
 * pas quand un apercu de drag a deja deplace la carte localement.
 */
export function sameCardRequest(a: CardMoveRequest | null, b: CardMoveRequest | null): boolean {
  if (a === null || b === null) return a === b;
  return (
    a.columnId === b.columnId &&
    a.beforeCardId === b.beforeCardId &&
    a.afterCardId === b.afterCardId
  );
}

export function sameColumnRequest(a: ColumnMoveRequest | null, b: ColumnMoveRequest | null): boolean {
  if (a === null || b === null) return a === b;
  return a.beforeColumnId === b.beforeColumnId && a.afterColumnId === b.afterColumnId;
}

/**
 * Le pointeur a-t-il depasse le milieu de la carte survolee ?
 *
 * Fonction pure (des nombres, pas des rectangles dnd-kit) pour rester testable :
 * c'est elle qui decide si un depot inter-colonnes atterrit avant ou apres la
 * carte survolee.
 */
export function shouldPlaceAfter(
  activeTop: number,
  overTop: number,
  overHeight: number,
): boolean {
  return activeTop > overTop + overHeight / 2;
}

/* ------------------------------------------------------------------ */
/*  Titre de colonne                                                    */
/* ------------------------------------------------------------------ */

/**
 * Titre affiche d'une colonne.
 *
 * Les colonnes posees a la creation (RG-3) et les six statuts d'un board-lien
 * (§11.3) portent un `titleKey` et sont traduits fr/en
 * (`isTranslatableColumnKey`) ; des qu'un humain renomme la colonne,
 * `titleKey` passe a `null` cote serveur et c'est son titre qui s'affiche tel
 * quel.
 */
export function resolveColumnTitle(
  column: { title: string; titleKey?: string | null },
  translate: (key: string, fallback: string) => string,
): string {
  const key = column.titleKey;
  return isTranslatableColumnKey(key) ? translate(`column.defaults.${key}`, column.title) : column.title;
}
