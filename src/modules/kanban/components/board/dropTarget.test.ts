import { describe, expect, it } from 'vitest';
import { resolveDropColumnId } from '@/modules/kanban/components/board/dropTarget';
import type { CardOrder } from '@/modules/kanban/components/board/kanbanDnd';

const order: CardOrder = {
  'col-a': ['card-2'],
  'col-b': ['card-1', 'card-3'],
};

describe('resolveDropColumnId', () => {
  it('suit l’ordre affiche plutot que la colonne declaree par la carte', () => {
    // `card-1` vient de `col-a` selon l'instantane serveur, mais l'apercu de
    // drag l'a deja posee dans `col-b` : c'est `col-b` qui doit primer.
    const stale = { type: 'card', cardId: 'card-1', columnId: 'col-a' };
    expect(resolveDropColumnId(order, stale)).toBe('col-b');
  });

  it('retombe sur la colonne declaree pour une carte absente de l’ordre', () => {
    const unknownCard = { type: 'card', cardId: 'card-9', columnId: 'col-a' };
    expect(resolveDropColumnId(order, unknownCard)).toBe('col-a');
  });

  it('accepte une colonne (ou sa zone de depot) telle quelle', () => {
    expect(resolveDropColumnId(order, { type: 'column', columnId: 'col-a' })).toBe('col-a');
  });

  it('renvoie null quand le survol ne porte rien de connu', () => {
    expect(resolveDropColumnId(order, undefined)).toBeNull();
    expect(resolveDropColumnId(order, { type: 'other' })).toBeNull();
  });
});
