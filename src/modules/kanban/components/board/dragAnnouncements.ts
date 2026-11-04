/**
 * Annonces du glisser-deposer pour les lecteurs d'ecran — logique PURE,
 * testee dans les deux modes (`tests/unit/dragAnnouncements.test.ts`).
 *
 * Une annonce, ce sont deux decisions :
 *  1. OU l'element atterrirait si on le lachait maintenant — par la MEME
 *     projection que l'apercu et le depot (`projectCardDrop`, blueprint D16) ;
 *  2. QUEL message le dit — un rang promis, ou « ordre automatique » quand une
 *     carte revient dans la colonne d'origine d'un ordre canonique (board-lien),
 *     ou elle ne bougera pas.
 * Elles vivaient dans `KanbanBoard`, ou aucun test ne les atteignait : des
 * annonces fausses passaient la suite sans un signal (constat #31). Le
 * composant ne garde que ce qui demande dnd-kit et le DOM — la cible lue sur
 * les rectangles (`dropTargetFor`) — et la traduction : ce module ne rend que
 * des cles et des valeurs.
 */
import { projectCardDrop, staysInCanonicalColumn, type CardDropMode } from './canonicalDnd';
import {
  cardPosition,
  columnOfCard,
  columnPosition,
  isCardDragData,
  isColumnDragData,
  moveColumnInOrder,
  type CardDropTarget,
  type CardOrder,
} from './kanbanDnd';

/** Message a traduire : cle i18n, texte de repli (francais), valeurs interpolees. */
export interface DragMessage {
  key: string;
  fallback: string;
  values: Readonly<Record<string, string | number>>;
}

/** Etat du tableau au moment d'annoncer (celui du dernier rendu). */
export interface DragScene {
  /** Ordre AFFICHE des cartes, apercu du glisser compris. */
  cardOrder: CardOrder;
  /** Ordre hors apercu : la colonne d'ORIGINE d'une carte s'y lit. */
  baseCardOrder: CardOrder;
  /** Ordre affiche des colonnes, apercu compris. */
  columnIds: readonly string[];
  /** Regle d'ordre : canonique (board-lien) ou manuelle (board kanban). */
  mode: CardDropMode;
}

/** Noms affiches des cartes et des colonnes. */
export interface DragNames {
  cardTitle: (cardId: string) => string;
  columnTitle: (columnId: string) => string;
}

/**
 * Ou atterrirait l'element tenu. `stays` : la carte est revenue dans la colonne
 * d'origine d'un ordre canonique — rien ne bouge, et le depot n'enverra rien.
 */
export type DragProjection =
  | { kind: 'card'; id: string; stays: boolean; order: CardOrder }
  | { kind: 'column'; id: string; ids: readonly string[] };

/**
 * Projection du geste en cours. `cardTarget` est la cible d'un depot de carte
 * (carte survolee et cote franchi, ou zone de la colonne), lue par l'appelant
 * sur les rectangles ; une colonne tenue l'ignore. `null` : rien de connu n'est
 * tenu.
 */
export function projectDrag(
  activeData: unknown,
  toColumnId: string,
  cardTarget: CardDropTarget,
  scene: DragScene,
): DragProjection | null {
  if (isCardDragData(activeData)) {
    /*
     * Colonne d'ORIGINE lue sur l'ordre hors apercu, pas sur la `dragData` :
     * une fois la carte rendue dans la colonne survolee, sa `dragData` y
     * annonce deja cette colonne, et l'on aurait dit « reste a sa place »
     * d'une carte qui vient d'en changer.
     */
    const origin = columnOfCard(scene.baseCardOrder, activeData.cardId) ?? activeData.columnId;
    return {
      kind: 'card',
      id: activeData.cardId,
      stays: staysInCanonicalColumn(scene.mode.canonical, origin, toColumnId),
      order: projectCardDrop(scene.cardOrder, activeData.cardId, cardTarget, scene.mode),
    };
  }
  if (isColumnDragData(activeData)) {
    return {
      kind: 'column',
      id: activeData.columnId,
      ids: moveColumnInOrder(scene.columnIds, activeData.columnId, toColumnId),
    };
  }
  return null;
}

/** Message sur la place d'une carte dans `order` ; `undefined` si elle n'y est pas. */
export function describeCard(
  order: CardOrder,
  cardId: string,
  key: string,
  fallback: string,
  names: DragNames,
): DragMessage | undefined {
  const place = cardPosition(order, cardId);
  if (place === null) return undefined;
  return {
    key,
    fallback,
    values: {
      title: names.cardTitle(cardId),
      column: names.columnTitle(place.columnId),
      position: place.position,
      total: place.total,
    },
  };
}

/** Message sur la place d'une colonne dans `ids` ; `undefined` si elle n'y est pas. */
export function describeColumn(
  ids: readonly string[],
  columnId: string,
  key: string,
  fallback: string,
  names: DragNames,
): DragMessage | undefined {
  const place = columnPosition(ids, columnId);
  if (place === null) return undefined;
  return { key, fallback, values: { title: names.columnTitle(columnId), position: place.position, total: place.total } };
}

/** Saisie d'un element : sa place de depart. */
export function dragStartMessage(activeData: unknown, scene: DragScene, names: DragNames): DragMessage | undefined {
  if (isCardDragData(activeData)) {
    return describeCard(
      scene.cardOrder,
      activeData.cardId,
      'dnd.cardGrabbed',
      'Carte {{title}} saisie, position {{position}} sur {{total}} dans la colonne {{column}}. Utilisez les flèches pour la déplacer, Espace ou Entrée pour déposer, Échap pour annuler.',
      names,
    );
  }
  if (isColumnDragData(activeData)) {
    return describeColumn(
      scene.columnIds,
      activeData.columnId,
      'dnd.columnStart',
      'Colonne {{title}} saisie, position {{position}} sur {{total}}. Utilisez les flèches pour la déplacer, Espace pour déposer, Échap pour annuler.',
      names,
    );
  }
  return undefined;
}

/** Survol : la place PROJETEE, ou « ordre automatique » si la carte ne bougera pas. */
export function dragOverMessage(projection: DragProjection | null, names: DragNames): DragMessage | undefined {
  if (projection === null) return undefined;
  if (projection.kind === 'column') {
    return describeColumn(projection.ids, projection.id, 'dnd.columnOver', 'Colonne {{title}} en position {{position}} sur {{total}}.', names);
  }
  return projection.stays
    ? describeCard(
        projection.order,
        projection.id,
        'dnd.cardCanonicalStay',
        'Ordre automatique : la carte {{title}} reste en position {{position}} sur {{total}} dans la colonne {{column}}.',
        names,
      )
    : describeCard(
        projection.order,
        projection.id,
        'dnd.cardOver',
        'Carte {{title}} en position {{position}} sur {{total}} dans la colonne {{column}}.',
        names,
      );
}

/** Lacher : la place obtenue (ou laissee), « place d'origine » sans cible. */
export function dragEndMessage(projection: DragProjection | null, scene: DragScene, names: DragNames): DragMessage | undefined {
  if (projection === null) return { key: 'dnd.dropped', fallback: 'Élément déposé à sa place d’origine.', values: {} };
  if (projection.kind === 'column') {
    return describeColumn(
      // Au LACHER, l'ordre affiche est deja le resultat : le rejouer
      // annoncerait la position d'avant le geste (cf. `handleDragEnd`).
      scene.columnIds,
      projection.id,
      'dnd.columnEnd',
      'Colonne {{title}} déposée en position {{position}} sur {{total}}.',
      names,
    );
  }
  return projection.stays
    ? describeCard(
        projection.order,
        projection.id,
        'dnd.cardCanonicalStayEnd',
        'Carte {{title}} laissée en position {{position}} sur {{total}} dans la colonne {{column}} : l’ordre y est automatique.',
        names,
      )
    : describeCard(
        projection.order,
        projection.id,
        'dnd.cardEnd',
        'Carte {{title}} déposée en position {{position}} sur {{total}} dans la colonne {{column}}.',
        names,
      );
}

/** Annulation : l'element garde sa place d'origine. */
export function dragCancelMessage(activeData: unknown, names: DragNames): DragMessage {
  const title = isCardDragData(activeData)
    ? names.cardTitle(activeData.cardId)
    : isColumnDragData(activeData)
      ? names.columnTitle(activeData.columnId)
      : '';
  return {
    key: 'dnd.cancelled',
    fallback: 'Déplacement de {{title}} annulé, la place d’origine est conservée.',
    values: { title },
  };
}
