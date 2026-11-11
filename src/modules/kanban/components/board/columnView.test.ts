/**
 * Colonne affichee (constats #52, #38, #64) : fenetre de cartes, depot sur une
 * colonne tronquee, focus apres un retrait, defilement jusqu'a une carte.
 */
import { describe, expect, test } from 'vitest';
import {
  CARD_WINDOW_SIZE,
  focusTargetAfterRemoval,
  scrollTopToReveal,
  showMoreCount,
  windowCardIds,
  windowLimitCovering,
  windowLimitOf,
  zoneDropTarget,
} from '@/modules/kanban/components/board/columnView';

const ids = (count: number) => Array.from({ length: count }, (_, index) => `c${index}`);

describe('windowCardIds', () => {
  test('une colonne qui tient dans la fenetre garde la MEME reference (memoisation)', () => {
    const list = ids(10);
    expect(windowCardIds(list, CARD_WINDOW_SIZE)).toBe(list);
  });

  test('au-dela, seules les premieres cartes sont rendues, dans l ordre', () => {
    expect(windowCardIds(ids(880), 50)).toEqual(ids(50));
  });

  test('la carte tenue pendant un glisser est rendue meme hors fenetre, a la suite', () => {
    const list = ids(120);
    const visible = windowCardIds(list, 50, 'c99');
    expect(visible).toHaveLength(51);
    expect(visible[50]).toBe('c99');
    // Deja visible ou inconnue : rien n'est ajoute.
    expect(windowCardIds(list, 50, 'c3')).toHaveLength(50);
    expect(windowCardIds(list, 50, 'ailleurs')).toHaveLength(50);
  });
});

describe('fenetre : nombre a ajouter et elargissement', () => {
  test('« Afficher N de plus » ajoute une fenetre, ou le reste', () => {
    expect(showMoreCount(880, 50)).toBe(50);
    expect(showMoreCount(120, 100)).toBe(20);
    expect(showMoreCount(40, 50)).toBe(0);
  });

  test('la fenetre couvrant un index est un multiple de la taille, jamais plus petite', () => {
    expect(windowLimitCovering(10, 50)).toBe(50);
    expect(windowLimitCovering(50, 50)).toBe(100);
    expect(windowLimitCovering(612, 50)).toBe(650);
    expect(windowLimitCovering(3, 150)).toBe(150);
  });

  test('fenetre par defaut tant qu une colonne n a pas ete elargie', () => {
    expect(windowLimitOf({}, 'todo')).toBe(CARD_WINDOW_SIZE);
    expect(windowLimitOf({ done: 150 }, 'done')).toBe(150);
  });
});

describe('zoneDropTarget', () => {
  test('colonne entiere affichee : la fin de colonne, comme avant', () => {
    expect(zoneDropTarget(ids(10), 50)).toEqual({});
  });

  test('colonne tronquee : apres la derniere carte AFFICHEE, pas au fond cache', () => {
    expect(zoneDropTarget(ids(120), 50)).toEqual({ overCardId: 'c49', placeAfter: true });
  });
});

describe('focusTargetAfterRemoval', () => {
  test('la suivante, sinon la precedente, sinon rien', () => {
    expect(focusTargetAfterRemoval(['a', 'b', 'c'], 'b')).toBe('c');
    expect(focusTargetAfterRemoval(['a', 'b', 'c'], 'c')).toBe('b');
    expect(focusTargetAfterRemoval(['a'], 'a')).toBeNull();
    expect(focusTargetAfterRemoval(['a'], 'inconnue')).toBeNull();
  });
});

describe('scrollTopToReveal', () => {
  test('element deja visible : aucun defilement', () => {
    expect(scrollTopToReveal({ itemTop: 100, itemHeight: 60, scrollTop: 0, viewHeight: 400 })).toBeNull();
  });

  test('element au-dessus : on remonte jusqu a lui, marge comprise', () => {
    expect(scrollTopToReveal({ itemTop: 100, itemHeight: 60, scrollTop: 300, viewHeight: 400 })).toBe(92);
  });

  test('element en dessous : on descend juste assez pour le montrer entier', () => {
    expect(scrollTopToReveal({ itemTop: 900, itemHeight: 60, scrollTop: 0, viewHeight: 400 })).toBe(568);
  });
});
