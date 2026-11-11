import { describe, expect, test } from 'vitest';
import { makeColumn } from '@/modules/kanban/__fixtures__/snapshot';
import { boardFlow } from './boardFlow';

describe('boardFlow', () => {
  test('un tronçon par colonne, dans l ordre du tableau, avec ses cartes', () => {
    const segments = boardFlow(
      [
        makeColumn('done', 3000, { cardCount: 52, isDoneColumn: true }),
        makeColumn('todo', 1000, { cardCount: 6 }),
        makeColumn('tracking', 2000, { cardCount: 0 }),
      ],
      5,
    );
    expect(segments.map((segment) => [segment.column._id, segment.count, segment.done])).toEqual([
      ['todo', 6, false],
      ['tracking', 0, false],
      ['done', 52, true],
    ]);
  });

  test('la teinte s affermit vers l aval, colonnes vides comprises ; la colonne de fin n en a pas', () => {
    const columns = ['a', 'b', 'c', 'd', 'e'].map((id, index) => makeColumn(id, (index + 1) * 1000, { cardCount: id === 'b' ? 0 : 1 }));
    const segments = boardFlow([...columns, makeColumn('done', 9000, { isDoneColumn: true })], 5);
    expect(segments.map((segment) => segment.tone)).toEqual([0, 1, 2, 3, 4, null]);
  });

  test('plus de colonnes ouvertes que de teintes : les rangs se répartissent sur la gamme', () => {
    const columns = Array.from({ length: 9 }, (_, index) => makeColumn(`c${index}`, index * 1000));
    expect(boardFlow(columns, 5).map((segment) => segment.tone)).toEqual([0, 1, 1, 2, 2, 3, 3, 4, 4]);
  });

  test('une seule colonne ouverte prend la teinte la plus soutenue', () => {
    const segments = boardFlow([makeColumn('todo', 1000), makeColumn('done', 2000, { isDoneColumn: true })], 5);
    expect(segments.map((segment) => segment.tone)).toEqual([4, null]);
  });

  test('aucune colonne : aucun tronçon', () => {
    expect(boardFlow([], 5)).toEqual([]);
  });
});
