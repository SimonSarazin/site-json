// @vitest-environment jsdom
/**
 * Le glisser-deposer du tableau MONTE, branche canonique comprise (constat #31). Repris de
 * co-kanban (`tests/unit/kanbanBoardDrag.test.tsx`).
 *
 * jsdom n'a pas de mise en page : dnd-kit n'y trouve aucune cible. On rejoue
 * donc ce que dnd-kit fait, et seulement cela : il appelle les gestionnaires
 * passes a `DndContext` (`onDragStart` / `onDragOver` / `onDragEnd`) et les
 * annonces (`accessibility.announcements`) avec la carte tenue et la cible
 * survolee. Le vrai `DndContext` reste rendu ; ses props sont seulement
 * relevees au passage. Ce qui est eprouve, c'est le BRANCHEMENT du tableau :
 * mode d'ordre transmis a l'apercu, au depot et aux annonces — que les tests
 * purs (`dragAnnouncements`, `canonicalDnd`) ne voient pas. Sans lui, couper
 * le mode canonique de l'apercu, du depot et des annonces passait la suite.
 */
import '@/modules/kanban/i18n';
import type * as DndKit from '@dnd-kit/core';
import type { Active, ClientRect, DndContextProps, Over } from '@dnd-kit/core';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest';
import { KanbanBoard } from '@/modules/kanban/components/board/KanbanBoard';
import type { CardMoveRequest } from '@/modules/kanban/components/board/kanbanDnd';
import type { BoardSnapshot, Card } from '@/modules/kanban/types';
import { CAPABILITIES, LINK_CAPABILITIES, makeAction, makeColumn, makeLinkColumns, makeSnapshot } from '@/modules/kanban/__fixtures__/snapshot';

/** Props du `DndContext`, relevees a chaque rendu du tableau. */
interface Relay {
  props: DndContextProps | null;
}
const relay = vi.hoisted((): Relay => ({ props: null }));

vi.mock('@dnd-kit/core', async (importOriginal) => {
  const actual = await importOriginal<typeof DndKit>();
  const { createElement } = await import('react');
  /** Le vrai contexte, dont on releve les props a chaque rendu. */
  function RelayedDndContext(props: DndContextProps) {
    relay.props = props;
    return createElement(actual.DndContext, props);
  }
  return { ...actual, DndContext: RelayedDndContext };
});

beforeAll(() => {
  // jsdom n'implemente pas `matchMedia`, que le tableau lit pour le mouvement reduit.
  window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener: () => {}, removeEventListener: () => {} });
});

afterEach(() => {
  cleanup();
  relay.props = null;
});

function dnd(): DndContextProps {
  if (relay.props === null) throw new Error('DndContext non rendu');
  return relay.props;
}

function announcements() {
  const value = dnd().accessibility?.announcements;
  if (value === undefined) throw new Error('le tableau ne passe pas ses annonces a dnd-kit');
  return value;
}

/* ------------------------------------------------------------------ */
/*  Ce que dnd-kit transmettrait                                        */
/* ------------------------------------------------------------------ */

function rect(top: number, height = 80): ClientRect {
  return { top, left: 0, width: 260, height, bottom: top + height, right: 260 };
}

/** Carte tenue ; `top` : haut de son rectangle deplace (decide du cote franchi). */
function held(cardId: string, columnId: string, top: number): Active {
  return {
    id: `card:${cardId}`,
    data: { current: { type: 'card', cardId, columnId } },
    rect: { current: { initial: rect(0), translated: rect(top) } },
  };
}

/** Carte survolee, a la hauteur `top`. */
function overCard(cardId: string, columnId: string, top: number): Over {
  return { id: `card:${cardId}`, rect: rect(top), disabled: false, data: { current: { type: 'card', cardId, columnId } } };
}

/**
 * Evenement de survol ou de lacher. Geste au CLAVIER : c'est lui qui pose le
 * focus sur la carte arrivee dans une autre colonne.
 */
function gesture(active: Active, over: Over | null) {
  return { activatorEvent: new KeyboardEvent('keydown'), active, over, collisions: null, delta: { x: 0, y: 0 } };
}

/* ------------------------------------------------------------------ */
/*  Tableau monte                                                       */
/* ------------------------------------------------------------------ */

function mount(snapshot: BoardSnapshot) {
  const onMoveCard = vi.fn<(intent: CardMoveRequest) => void>();
  // Le titre d'une carte est le lien de sa fiche : il lui faut un routeur.
  render(<KanbanBoard snapshot={snapshot} hiddenColumnIds={[]} onHideColumn={() => {}} onMoveCard={onMoveCard} onMoveColumn={() => {}} />, { wrapper: MemoryRouter });
  return onMoveCard;
}

function renderedTitles(columnName: string): string[] {
  const list = screen.getByRole('list', { name: `Cartes de la colonne ${columnName}` });
  return within(list)
    .queryAllByRole('article')
    .map((article) => article.getAttribute('aria-labelledby') ?? '')
    .map((id) => document.getElementById(id)?.textContent ?? '');
}

const action = (id: string, columnId: string, rank: number): Card => makeAction(id, columnId, { title: `Carte ${id}`, rank });

/** Board-lien : trois cartes dans « À faire », trois dans « En cours » ; c0 a le rang 1. */
function linkSnapshot(): BoardSnapshot {
  return makeSnapshot({
    columns: makeLinkColumns(),
    cards: [
      action('c0', 'todo', 1),
      action('c1', 'todo', 2),
      action('c2', 'todo', 3),
      action('t0', 'tracking', 0.5),
      action('t1', 'tracking', 1.5),
      action('t2', 'tracking', 2.5),
    ],
    capabilities: LINK_CAPABILITIES,
  });
}

describe('board-lien (ordre canonique)', () => {
  test('meme colonne, lachee sous la derniere carte : aucun apercu, « ordre automatique », aucune requete', () => {
    const onMoveCard = mount(linkSnapshot());
    const active = held('c0', 'todo', 300);
    const over = overCard('c2', 'todo', 200);

    act(() => dnd().onDragStart?.({ activatorEvent: new KeyboardEvent('keydown'), active }));
    expect(announcements().onDragOver({ active, over })).toBe(
      'Ordre automatique : la carte Carte c0 reste en position 1 sur 3 dans la colonne À faire.',
    );
    act(() => dnd().onDragOver?.(gesture(active, over)));
    // Aucune voisine ne s'ecarte : un depot y reviendrait a sa place.
    expect(renderedTitles('À faire')).toEqual(['Carte c0', 'Carte c1', 'Carte c2']);

    expect(announcements().onDragEnd({ active, over })).toBe(
      'Carte Carte c0 laissée en position 1 sur 3 dans la colonne À faire : l’ordre y est automatique.',
    );
    act(() => dnd().onDragEnd?.(gesture(active, over)));
    expect(onMoveCard).not.toHaveBeenCalled();
  });

  test('autre colonne, lachee sous la derniere carte : son RANG canonique, a l apercu, a l annonce et au depot', () => {
    const onMoveCard = mount(linkSnapshot());
    const active = held('c0', 'todo', 300);
    // Sous t2 (la derniere) : l'ordre manuel la mettrait en 4 sur 4.
    const over = overCard('t2', 'tracking', 200);

    act(() => dnd().onDragStart?.({ activatorEvent: new KeyboardEvent('keydown'), active }));
    expect(announcements().onDragOver({ active, over })).toBe('Carte Carte c0 en position 2 sur 4 dans la colonne En cours.');
    act(() => dnd().onDragOver?.(gesture(active, over)));
    expect(renderedTitles('En cours')).toEqual(['Carte t0', 'Carte c0', 'Carte t1', 'Carte t2']);

    expect(announcements().onDragEnd({ active, over })).toBe('Carte Carte c0 déposée en position 2 sur 4 dans la colonne En cours.');
    act(() => dnd().onDragEnd?.(gesture(active, over)));
    expect(onMoveCard).toHaveBeenCalledTimes(1);
    expect(onMoveCard).toHaveBeenCalledWith({ cardId: 'c0', columnId: 'tracking', afterCardId: 't0' });
  });
});

describe('board kanban (ordre manuel)', () => {
  test('meme colonne, lachee sous la derniere carte : elle y passe, annoncee 3 sur 3, intention envoyee', () => {
    const onMoveCard = mount(
      makeSnapshot({
        columns: [makeColumn('todo', 1000, { title: 'À faire' }), makeColumn('done', 2000, { title: 'Fini', isDoneColumn: true })],
        cards: [action('c0', 'todo', 1), action('c1', 'todo', 2), action('c2', 'todo', 3)],
        capabilities: CAPABILITIES,
      }),
    );
    const active = held('c0', 'todo', 300);
    const over = overCard('c2', 'todo', 200);

    act(() => dnd().onDragStart?.({ activatorEvent: new KeyboardEvent('keydown'), active }));
    expect(announcements().onDragOver({ active, over })).toBe('Carte Carte c0 en position 3 sur 3 dans la colonne À faire.');
    act(() => dnd().onDragOver?.(gesture(active, over)));
    expect(announcements().onDragEnd({ active, over })).toBe('Carte Carte c0 déposée en position 3 sur 3 dans la colonne À faire.');
    act(() => dnd().onDragEnd?.(gesture(active, over)));
    expect(onMoveCard).toHaveBeenCalledWith({ cardId: 'c0', columnId: 'todo', afterCardId: 'c2' });
  });
});
