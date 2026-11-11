/**
 * Annonces du glisser-deposer (constat #31) : projection + choix du message,
 * dans les DEUX modes — board kanban (ordre manuel) et board-lien (ordre
 * canonique, blueprint D16). Avant leur sortie de `KanbanBoard`, des annonces
 * fausses (projection manuelle sur un board-lien, « reste a sa place » coupe)
 * passaient toute la suite.
 */
import i18next from 'i18next';
import '@/i18n';
import { describe, expect, test } from 'vitest';
import type { CardOrder } from '@/modules/kanban/components/board/kanbanDnd';
import {
  describeCard,
  dragCancelMessage,
  dragEndMessage,
  dragOverMessage,
  dragStartMessage,
  projectDrag,
  type DragMessage,
  type DragNames,
  type DragScene,
} from '@/modules/kanban/components/board/dragAnnouncements';

/* Rangs canoniques : dans « En cours », b (20) se range entre y (15) et z (25). */
const RANKS: Record<string, number> = { a: 10, b: 20, c: 30, x: 5, y: 15, z: 25 };
const rankOf = (id: string) => RANKS[id] ?? Number.POSITIVE_INFINITY;

const ORDER: CardOrder = { todo: ['a', 'b', 'c'], doing: ['x', 'y', 'z'] };
const NAMES: DragNames = {
  cardTitle: (id) => `Carte ${id}`,
  columnTitle: (id) => (id === 'todo' ? 'À faire' : 'En cours'),
};

const LINK: DragScene = { cardOrder: ORDER, baseCardOrder: ORDER, columnIds: ['todo', 'doing'], mode: { canonical: true, rankOf } };
const KANBAN: DragScene = { ...LINK, mode: { canonical: false, rankOf } };

const card = (cardId: string, columnId: string) => ({ type: 'card', cardId, columnId });

/** Le message tel que le lecteur d'ecran l'entend (catalogue francais). */
function spoken(message: DragMessage | undefined): string | undefined {
  return message === undefined ? undefined : i18next.t(message.key, message.fallback, message.values);
}

describe('board-lien : ordre canonique', () => {
  test('meme colonne, pointeur sous la derniere carte : « ordre automatique », la carte reste premiere', () => {
    const projection = projectDrag(card('a', 'todo'), 'todo', { columnId: 'todo', overCardId: 'c', placeAfter: true }, LINK);
    expect(spoken(dragOverMessage(projection, NAMES))).toBe(
      'Ordre automatique : la carte Carte a reste en position 1 sur 3 dans la colonne À faire.',
    );
    expect(spoken(dragEndMessage(projection, LINK, NAMES))).toBe(
      'Carte Carte a laissée en position 1 sur 3 dans la colonne À faire : l’ordre y est automatique.',
    );
  });

  test('autre colonne : le RANG canonique, pas la place sous le pointeur', () => {
    // Le pointeur est sous z (derniere) : une projection manuelle dirait 4 sur 4.
    const projection = projectDrag(card('b', 'todo'), 'doing', { columnId: 'doing', overCardId: 'z', placeAfter: true }, LINK);
    expect(spoken(dragOverMessage(projection, NAMES))).toBe('Carte Carte b en position 3 sur 4 dans la colonne En cours.');
    expect(spoken(dragEndMessage(projection, LINK, NAMES))).toBe(
      'Carte Carte b déposée en position 3 sur 4 dans la colonne En cours.',
    );
  });

  test('apres l apercu (carte deja rendue dans la colonne survolee) : meme rang, jamais « reste a sa place »', () => {
    const previewed: DragScene = { ...LINK, cardOrder: { todo: ['a', 'c'], doing: ['x', 'y', 'b', 'z'] } };
    // Sa `dragData` annonce deja « En cours » : l'origine se lit sur l'ordre hors apercu.
    const projection = projectDrag(card('b', 'doing'), 'doing', { columnId: 'doing', overCardId: 'x' }, previewed);
    expect(dragOverMessage(projection, NAMES)?.key).toBe('dnd.cardOver');
    expect(spoken(dragOverMessage(projection, NAMES))).toBe('Carte Carte b en position 3 sur 4 dans la colonne En cours.');
  });

  test('revenue dans sa colonne d origine apres un apercu : elle y reprend son rang, « ordre automatique »', () => {
    const previewed: DragScene = { ...LINK, cardOrder: { todo: ['a', 'c'], doing: ['x', 'y', 'b', 'z'] } };
    const projection = projectDrag(card('b', 'doing'), 'todo', { columnId: 'todo', overCardId: 'c', placeAfter: true }, previewed);
    expect(spoken(dragOverMessage(projection, NAMES))).toBe(
      'Ordre automatique : la carte Carte b reste en position 2 sur 3 dans la colonne À faire.',
    );
  });
});

describe('board kanban : ordre manuel', () => {
  test('meme colonne : la carte survolee et le cote franchi decident, sans « ordre automatique »', () => {
    const projection = projectDrag(card('a', 'todo'), 'todo', { columnId: 'todo', overCardId: 'c', placeAfter: true }, KANBAN);
    expect(spoken(dragOverMessage(projection, NAMES))).toBe('Carte Carte a en position 3 sur 3 dans la colonne À faire.');
    expect(spoken(dragEndMessage(projection, KANBAN, NAMES))).toBe(
      'Carte Carte a déposée en position 3 sur 3 dans la colonne À faire.',
    );
  });

  test('autre colonne : la place sous le pointeur', () => {
    const projection = projectDrag(card('b', 'todo'), 'doing', { columnId: 'doing', overCardId: 'z', placeAfter: true }, KANBAN);
    expect(spoken(dragOverMessage(projection, NAMES))).toBe('Carte Carte b en position 4 sur 4 dans la colonne En cours.');
  });
});

describe('colonnes, saisie, annulation, cas limites', () => {
  test('colonne tenue : place projetee au survol, ordre affiche (deja le resultat) au lacher', () => {
    const column = { type: 'column', columnId: 'todo' };
    const projection = projectDrag(column, 'doing', { columnId: 'doing' }, LINK);
    expect(spoken(dragOverMessage(projection, NAMES))).toBe('Colonne À faire en position 2 sur 2.');
    const dropped: DragScene = { ...LINK, columnIds: ['doing', 'todo'] };
    expect(spoken(dragEndMessage(projection, dropped, NAMES))).toBe('Colonne À faire déposée en position 2 sur 2.');
  });

  test('saisie : la place de depart', () => {
    expect(spoken(dragStartMessage(card('b', 'todo'), LINK, NAMES))).toMatch(
      /^Carte Carte b saisie, position 2 sur 3 dans la colonne À faire\./,
    );
    expect(spoken(dragStartMessage({ type: 'column', columnId: 'doing' }, LINK, NAMES))).toMatch(
      /^Colonne En cours saisie, position 2 sur 2\./,
    );
    expect(dragStartMessage({ type: 'autre' }, LINK, NAMES)).toBeUndefined();
  });

  test('rien de connu tenu, ou lache hors cible : place d origine', () => {
    expect(projectDrag({ type: 'autre' }, 'todo', { columnId: 'todo' }, LINK)).toBeNull();
    expect(dragOverMessage(null, NAMES)).toBeUndefined();
    expect(spoken(dragEndMessage(null, LINK, NAMES))).toBe('Élément déposé à sa place d’origine.');
  });

  test('annulation : le titre de ce qui etait tenu', () => {
    expect(spoken(dragCancelMessage(card('c', 'todo'), NAMES))).toBe(
      'Déplacement de Carte c annulé, la place d’origine est conservée.',
    );
    expect(dragCancelMessage({ type: 'column', columnId: 'todo' }, NAMES).values.title).toBe('À faire');
  });

  test('carte absente de l ordre : aucun message plutot qu une position inventee', () => {
    expect(describeCard(ORDER, 'fantome', 'dnd.cardOver', '', NAMES)).toBeUndefined();
  });
});
