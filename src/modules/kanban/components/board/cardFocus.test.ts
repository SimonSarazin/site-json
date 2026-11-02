// @vitest-environment jsdom
/**
 * Reperage d'une carte rendue et de son element focalisable (`cardFocus.ts`),
 * partage par la colonne et le tableau.
 */
import { afterEach, describe, expect, test } from 'vitest';
import { cardElementIn, cardFocusTargetIn, cardLinkIn } from '@/modules/kanban/components/board/cardFocus';

afterEach(() => {
  document.body.replaceChildren();
});

/** Une pile : une carte d'editeur (poignee + lien), une carte lue (lien seul), un id a echapper. */
function mountColumn(): HTMLElement {
  const list = document.createElement('ul');
  const cards: Array<{ id: string; handle: boolean }> = [
    { id: 'editable', handle: true },
    { id: 'lecture', handle: false },
    { id: 'a"b]c', handle: false },
  ];
  for (const { id, handle } of cards) {
    const article = document.createElement('article');
    article.dataset.cardId = id;
    if (handle) {
      const grip = document.createElement('button');
      grip.setAttribute('data-card-handle', '');
      grip.textContent = `poignee ${id}`;
      article.append(grip);
    }
    const link = document.createElement('a');
    link.href = `/board/b1/card/${encodeURIComponent(id)}`;
    link.textContent = `titre ${id}`;
    article.append(link);
    list.append(article);
  }
  document.body.append(list);
  return list;
}

describe('cardElementIn', () => {
  test('trouve la fiche par son identifiant, meme non echappable en selecteur', () => {
    const list = mountColumn();
    expect(cardElementIn(list, 'a"b]c')?.dataset.cardId).toBe('a"b]c');
    expect(cardElementIn(list, 'absente')).toBeNull();
    expect(cardElementIn(null, 'editable')).toBeNull();
  });
});

describe('cardFocusTargetIn', () => {
  test('editeur : la poignee, premier arret clavier de la carte', () => {
    expect(cardFocusTargetIn(mountColumn(), 'editable')?.textContent).toBe('poignee editable');
  });

  test('lecture seule (pas de poignee) : le lien du titre, pas rien', () => {
    expect(cardFocusTargetIn(mountColumn(), 'lecture')?.textContent).toBe('titre lecture');
  });

  test('carte non rendue : null (l appelant se rabat sur une commande de la colonne)', () => {
    expect(cardFocusTargetIn(mountColumn(), 'absente')).toBeNull();
  });
});

describe('cardLinkIn', () => {
  test('carte du tableau : le lien de son titre, pas sa poignée', () => {
    expect(cardLinkIn(mountColumn(), 'editable')?.textContent).toBe('titre editable');
  });

  test('ligne entière en lien (Liste, Table, Chronologie) : la ligne elle-même', () => {
    const row = document.createElement('a');
    row.href = '/kanban/actions/liste/carte/r1';
    row.dataset.cardId = 'r1';
    document.body.append(row);
    expect(cardLinkIn(document, 'r1')).toBe(row);
    expect(cardLinkIn(document, 'absente')).toBeNull();
  });
});
