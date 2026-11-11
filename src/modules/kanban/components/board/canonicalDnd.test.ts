/**
 * Apercu du glisser sur un board-lien (blueprint D16, DESIGN §6.4) : aucune
 * place dans sa propre colonne, le rang canonique dans une autre.
 */
import { describe, expect, test } from 'vitest';
import {
  hasCanonicalOrder,
  moveCardToCanonicalSlot,
  projectCardDrop,
  staysInCanonicalColumn,
} from '@/modules/kanban/components/board/canonicalDnd';

const RANKS: Record<string, number> = { a: 10, b: 20, c: 30, x: 25, y: 5, z: 99 };
const rankOf = (id: string) => RANKS[id] ?? Number.POSITIVE_INFINITY;

const ORDER = {
  todo: ['a', 'b', 'c'],
  done: ['y', 'x', 'z'],
};

describe('hasCanonicalOrder', () => {
  test('seul un board-lien a un ordre canonique', () => {
    expect(hasCanonicalOrder('communecter')).toBe(true);
    expect(hasCanonicalOrder('kanban')).toBe(false);
  });
});

describe('moveCardToCanonicalSlot', () => {
  test('dans sa propre colonne : rien ne bouge (meme reference)', () => {
    expect(moveCardToCanonicalSlot(ORDER, 'b', 'todo', rankOf)).toBe(ORDER);
  });

  test('vers une autre colonne : insere a son rang, pas sous le pointeur', () => {
    const next = moveCardToCanonicalSlot(ORDER, 'b', 'done', rankOf);
    expect(next.todo).toEqual(['a', 'c']);
    // b (20) se range entre y (5) et x (25).
    expect(next.done).toEqual(['y', 'b', 'x', 'z']);
  });

  test('rang le plus fort : en tete ; le plus faible : en queue', () => {
    expect(moveCardToCanonicalSlot(ORDER, 'y', 'todo', rankOf).todo).toEqual(['y', 'a', 'b', 'c']);
    expect(moveCardToCanonicalSlot(ORDER, 'z', 'todo', rankOf).todo).toEqual(['a', 'b', 'c', 'z']);
  });

  test('vers une colonne vide', () => {
    const order = { todo: ['a'], next: [] };
    expect(moveCardToCanonicalSlot(order, 'a', 'next', rankOf)).toEqual({ todo: [], next: ['a'] });
  });

  test('carte ou colonne inconnue : meme reference', () => {
    expect(moveCardToCanonicalSlot(ORDER, 'ghost', 'done', rankOf)).toBe(ORDER);
    expect(moveCardToCanonicalSlot(ORDER, 'a', 'nowhere', rankOf)).toBe(ORDER);
  });
});

/*
 * Constat #26 : l'apercu, le depot et les ANNONCES passent par la meme
 * projection. Les annonces calculaient leur propre rang (la carte sous le
 * pointeur) : « deposee en position 3 sur 4 » pour une carte restee premiere.
 */
describe('projectCardDrop', () => {
  const canonicalMode = { canonical: true, rankOf };
  const manualMode = { canonical: false, rankOf };

  test('board-lien, meme colonne : rien ne bouge, quelle que soit la carte survolee', () => {
    expect(projectCardDrop(ORDER, 'a', { columnId: 'todo', overCardId: 'c', placeAfter: true }, canonicalMode)).toBe(ORDER);
  });

  test('board-lien, autre colonne : rang canonique, la carte survolee ne compte pas', () => {
    const next = projectCardDrop(ORDER, 'b', { columnId: 'done', overCardId: 'z', placeAfter: true }, canonicalMode);
    expect(next.done).toEqual(['y', 'b', 'x', 'z']);
  });

  test('board-lien, apres l apercu (carte deja dans la colonne cible) : meme ordre, meme rang annonce', () => {
    const previewed = projectCardDrop(ORDER, 'b', { columnId: 'done' }, canonicalMode);
    expect(projectCardDrop(previewed, 'b', { columnId: 'done', overCardId: 'y' }, canonicalMode)).toBe(previewed);
  });

  test('board kanban : la carte survolee et le cote franchi decident (comportement inchange)', () => {
    expect(projectCardDrop(ORDER, 'b', { columnId: 'done', overCardId: 'x', placeAfter: true }, manualMode).done).toEqual([
      'y',
      'x',
      'b',
      'z',
    ]);
    expect(projectCardDrop(ORDER, 'a', { columnId: 'todo', overCardId: 'c' }, manualMode).todo).toEqual(['b', 'c', 'a']);
  });
});

describe('staysInCanonicalColumn', () => {
  test('seul un retour dans la colonne d origine d un ordre canonique « reste a sa place »', () => {
    expect(staysInCanonicalColumn(true, 'todo', 'todo')).toBe(true);
    expect(staysInCanonicalColumn(true, 'todo', 'done')).toBe(false);
    expect(staysInCanonicalColumn(false, 'todo', 'todo')).toBe(false);
  });
});
