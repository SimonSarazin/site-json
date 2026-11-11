import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { DndContext } from '@dnd-kit/core';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, test } from 'vitest';
import { TaskCard } from '@/modules/kanban/components/board/TaskCard';
import type { Card, Column } from '@/modules/kanban/types';
import '@/modules/kanban/i18n';
import {
  buildCardOrder,
  cardMoveRequest,
  cardPosition,
  cardSortableId,
  columnMoveRequest,
  columnOfCard,
  columnPosition,
  columnSortableId,
  columnZoneId,
  currentCardSlotIndex,
  dropTargetOfRequest,
  indexLabels,
  indexMembers,
  isCardDragData,
  isColumnDragData,
  listCardDropSlots,
  moveCardInOrder,
  moveColumnInOrder,
  planCardMove,
  planColumnMove,
  resolveColumnTitle,
  reuseUnchangedColumns,
  safeLabelColor,
  sameCardRequest,
  sameColumnRequest,
  shouldPlaceAfter,
  slotToRequest,
  splitDragListeners,
  targetCardOf,
  targetColumnOf,
  type CardOrder,
} from '@/modules/kanban/components/board/kanbanDnd';

const ORDER: CardOrder = {
  todo: ['a', 'b', 'c'],
  doing: ['d'],
  done: [],
};

describe('buildCardOrder', () => {
  it('range chaque carte dans sa colonne, triee par rang', () => {
    const order = buildCardOrder(
      [{ _id: 'todo' }, { _id: 'doing' }, { _id: 'done' }],
      [
        { _id: 'c2', columnId: 'todo', rank: 2000 },
        { _id: 'c1', columnId: 'todo', rank: 1000 },
        { _id: 'c3', columnId: 'doing', rank: 1000 },
      ],
    );
    expect(order).toEqual({ todo: ['c1', 'c2'], doing: ['c3'], done: [] });
  });

  it('conserve les colonnes vides, sinon elles n auraient pas de zone de depot', () => {
    const order = buildCardOrder([{ _id: 'vide' }], []);
    expect(order.vide).toEqual([]);
  });

  it('ignore une carte dont la colonne a disparu', () => {
    const order = buildCardOrder(
      [{ _id: 'todo' }],
      [{ _id: 'orpheline', columnId: 'supprimee', rank: 1000 }],
    );
    expect(order).toEqual({ todo: [] });
  });
});

/*
 * Constat #52 : une colonne inchangee garde son tableau, sinon le
 * `SortableContext` de dnd-kit rend de nouveau toutes ses cartes.
 */
describe('reuseUnchangedColumns', () => {
  test('rien n a change : la reference precedente est rendue', () => {
    const previous: CardOrder = { todo: ['a', 'b'], done: [] };
    expect(reuseUnchangedColumns(previous, { todo: ['a', 'b'], done: [] })).toBe(previous);
  });

  test('une colonne change : les autres gardent LEUR tableau', () => {
    const previous: CardOrder = { todo: ['a', 'b'], done: ['c'] };
    const next = reuseUnchangedColumns(previous, { todo: ['a'], done: ['c'] });
    expect(next).not.toBe(previous);
    expect(next.todo).toEqual(['a']);
    expect(next.done).toBe(previous.done);
  });

  test('une colonne apparait ou disparait : nouvel ordre', () => {
    const previous: CardOrder = { todo: ['a'] };
    expect(reuseUnchangedColumns(previous, { todo: ['a'], next: [] })).toEqual({ todo: ['a'], next: [] });
    expect(reuseUnchangedColumns({ todo: ['a'], next: [] }, previous)).toEqual(previous);
  });
});

/*
 * Constat #83 : la fiche se saisit au pointeur, la POIGNEE au clavier.
 */
describe('splitDragListeners', () => {
  test('les ecouteurs clavier vont a la poignee, les autres a la fiche', () => {
    const onKeyDown = () => {};
    const onMouseDown = () => {};
    const onTouchStart = () => {};
    const { pointer, keyboard } = splitDragListeners({ onKeyDown, onMouseDown, onTouchStart });
    expect(keyboard).toEqual({ onKeyDown });
    expect(pointer).toEqual({ onMouseDown, onTouchStart });
  });

  test('sortable desactive (aucun ecouteur) : deux objets vides', () => {
    expect(splitDragListeners(undefined)).toEqual({ pointer: {}, keyboard: {} });
  });
});

describe('dropTargetOfRequest', () => {
  test('ancre apres / avant / aucune : la cible equivalente du glisser', () => {
    expect(dropTargetOfRequest({ cardId: 'a', columnId: 'todo', afterCardId: 'b' })).toEqual({
      columnId: 'todo',
      overCardId: 'b',
      placeAfter: true,
    });
    expect(dropTargetOfRequest({ cardId: 'a', columnId: 'todo', beforeCardId: 'b' })).toEqual({
      columnId: 'todo',
      overCardId: 'b',
      placeAfter: false,
    });
    expect(dropTargetOfRequest({ cardId: 'a', columnId: 'done' })).toEqual({ columnId: 'done' });
  });
});

describe('columnOfCard / positions', () => {
  it('retrouve la colonne d une carte', () => {
    expect(columnOfCard(ORDER, 'b')).toBe('todo');
    expect(columnOfCard(ORDER, 'inconnue')).toBeNull();
  });

  it('donne une position 1-based pour les annonces', () => {
    expect(cardPosition(ORDER, 'b')).toEqual({ columnId: 'todo', position: 2, total: 3 });
    expect(cardPosition(ORDER, 'inconnue')).toBeNull();
    expect(columnPosition(['todo', 'doing'], 'doing')).toEqual({ position: 2, total: 2 });
    expect(columnPosition(['todo'], 'absente')).toBeNull();
  });
});

describe('identifiants dnd-kit', () => {
  it('prefixe chaque famille pour rendre toute collision impossible', () => {
    expect(cardSortableId('42')).toBe('card:42');
    expect(columnSortableId('42')).toBe('column:42');
    expect(columnZoneId('42')).toBe('zone:42');
  });
});

describe('gardes de type sur les donnees de drag', () => {
  it('reconnait une carte', () => {
    expect(isCardDragData({ type: 'card', cardId: 'a', columnId: 'todo' })).toBe(true);
    expect(isCardDragData({ type: 'card', cardId: 'a' })).toBe(false);
    expect(isCardDragData(null)).toBe(false);
    expect(isCardDragData(undefined)).toBe(false);
  });

  it('reconnait une colonne', () => {
    expect(isColumnDragData({ type: 'column', columnId: 'todo' })).toBe(true);
    expect(isColumnDragData({ type: 'card', cardId: 'a', columnId: 'todo' })).toBe(false);
  });

  it('resout la colonne visee quel que soit le survol', () => {
    expect(targetColumnOf({ type: 'card', cardId: 'a', columnId: 'todo' })).toBe('todo');
    expect(targetColumnOf({ type: 'column', columnId: 'doing' })).toBe('doing');
    expect(targetColumnOf({ type: 'autre' })).toBeNull();
    expect(targetCardOf({ type: 'card', cardId: 'a', columnId: 'todo' })).toBe('a');
    expect(targetCardOf({ type: 'column', columnId: 'todo' })).toBeNull();
  });
});

describe('moveCardInOrder — dans la meme colonne', () => {
  it('descendre une carte la place APRES celle qu on survole', () => {
    const next = moveCardInOrder(ORDER, 'a', { columnId: 'todo', overCardId: 'c' });
    expect(next.todo).toEqual(['b', 'c', 'a']);
  });

  it('remonter une carte la place AVANT celle qu on survole', () => {
    const next = moveCardInOrder(ORDER, 'c', { columnId: 'todo', overCardId: 'a' });
    expect(next.todo).toEqual(['c', 'a', 'b']);
  });

  it('renvoie la meme reference quand le geste ne change rien', () => {
    expect(moveCardInOrder(ORDER, 'a', { columnId: 'todo', overCardId: 'a' })).toBe(ORDER);
    expect(moveCardInOrder(ORDER, 'd', { columnId: 'doing' })).toBe(ORDER);
  });

  it('ignore une carte ou une colonne inconnue', () => {
    expect(moveCardInOrder(ORDER, 'inconnue', { columnId: 'todo' })).toBe(ORDER);
    expect(moveCardInOrder(ORDER, 'a', { columnId: 'inconnue' })).toBe(ORDER);
  });
});

describe('moveCardInOrder — vers une autre colonne', () => {
  it('insere avant la carte survolee par defaut', () => {
    const next = moveCardInOrder(ORDER, 'a', { columnId: 'doing', overCardId: 'd' });
    expect(next.doing).toEqual(['a', 'd']);
    expect(next.todo).toEqual(['b', 'c']);
  });

  it('insere apres la carte survolee quand le pointeur a depasse son bas', () => {
    const next = moveCardInOrder(ORDER, 'a', {
      columnId: 'doing',
      overCardId: 'd',
      placeAfter: true,
    });
    expect(next.doing).toEqual(['d', 'a']);
  });

  it('depose en fin de colonne quand aucune carte n est survolee', () => {
    const next = moveCardInOrder(ORDER, 'a', { columnId: 'doing' });
    expect(next.doing).toEqual(['d', 'a']);
  });

  it('accepte une colonne vide', () => {
    const next = moveCardInOrder(ORDER, 'b', { columnId: 'done' });
    expect(next.done).toEqual(['b']);
    expect(next.todo).toEqual(['a', 'c']);
  });

  it('ne mute jamais l ordre d origine', () => {
    moveCardInOrder(ORDER, 'a', { columnId: 'done' });
    expect(ORDER).toEqual({ todo: ['a', 'b', 'c'], doing: ['d'], done: [] });
  });

  it('survoler SA PROPRE carte ne la renvoie pas dans sa colonne de depart', () => {
    /*
     * Regression : la carte « a » a deja ete relogee dans `doing` par l'ordre
     * optimiste, mais les donnees du draggable survole portent toujours sa
     * colonne D'ORIGINE (`todo`). Se survoler soi-meme depuis une autre
     * colonne la reinserait alors au bas de `todo` — faux deplacement aussitot
     * persiste au depot. Le refus doit donc etre INCONDITIONNEL de la colonne.
     */
    const relocated = moveCardInOrder(ORDER, 'a', { columnId: 'doing', overCardId: 'd' });
    expect(relocated.doing).toEqual(['a', 'd']);

    const hoveringItself = moveCardInOrder(relocated, 'a', { columnId: 'todo', overCardId: 'a' });
    expect(hoveringItself).toBe(relocated);
    expect(hoveringItself.todo).toEqual(['b', 'c']);
    expect(hoveringItself.doing).toEqual(['a', 'd']);

    // Meme refus en annoncant la colonne courante : aucun deplacement non plus.
    expect(moveCardInOrder(relocated, 'a', { columnId: 'doing', overCardId: 'a' })).toBe(relocated);
  });
});

describe('cardMoveRequest', () => {
  it('ancre sur le voisin du dessus des qu il existe', () => {
    expect(cardMoveRequest(ORDER, 'b')).toEqual({
      cardId: 'b',
      columnId: 'todo',
      afterCardId: 'a',
    });
  });

  it('ancre sur le suivant en tete de colonne', () => {
    expect(cardMoveRequest(ORDER, 'a')).toEqual({
      cardId: 'a',
      columnId: 'todo',
      beforeCardId: 'b',
    });
  });

  it('n envoie aucun voisin pour une carte seule', () => {
    expect(cardMoveRequest(ORDER, 'd')).toEqual({ cardId: 'd', columnId: 'doing' });
  });

  it('renvoie null pour une carte absente', () => {
    expect(cardMoveRequest(ORDER, 'inconnue')).toBeNull();
  });
});

describe('planCardMove', () => {
  it('produit ordre optimiste et intention serveur', () => {
    const plan = planCardMove(ORDER, 'a', { columnId: 'doing', overCardId: 'd' });
    expect(plan).not.toBeNull();
    expect(plan?.order.doing).toEqual(['a', 'd']);
    expect(plan?.intent).toEqual({ cardId: 'a', columnId: 'doing', beforeCardId: 'd' });
  });

  it('renvoie null quand rien ne bouge : aucune requete ne doit partir', () => {
    expect(planCardMove(ORDER, 'd', { columnId: 'doing' })).toBeNull();
  });
});

describe('deplacement de colonne', () => {
  const columns = ['todo', 'doing', 'done'];

  it('deplace vers la droite en passant apres la colonne survolee', () => {
    expect(moveColumnInOrder(columns, 'todo', 'done')).toEqual(['doing', 'done', 'todo']);
  });

  it('deplace vers la gauche en passant avant la colonne survolee', () => {
    expect(moveColumnInOrder(columns, 'done', 'doing')).toEqual(['todo', 'done', 'doing']);
  });

  it('renvoie la meme reference si la cible est la colonne elle-meme ou est inconnue', () => {
    expect(moveColumnInOrder(columns, 'todo', 'todo')).toBe(columns);
    expect(moveColumnInOrder(columns, 'todo', 'absente')).toBe(columns);
  });

  it('traduit la position en intention', () => {
    expect(columnMoveRequest(['a', 'b', 'c'], 'b')).toEqual({ columnId: 'b', afterColumnId: 'a' });
    expect(columnMoveRequest(['a', 'b'], 'a')).toEqual({ columnId: 'a', beforeColumnId: 'b' });
    expect(columnMoveRequest(['a'], 'a')).toEqual({ columnId: 'a' });
    expect(columnMoveRequest(['a'], 'z')).toBeNull();
  });

  it('planColumnMove combine les deux', () => {
    const plan = planColumnMove(columns, 'todo', 'done');
    expect(plan?.order).toEqual(['doing', 'done', 'todo']);
    expect(plan?.intent).toEqual({ columnId: 'todo', afterColumnId: 'done' });
    expect(planColumnMove(columns, 'todo', 'todo')).toBeNull();
  });
});

describe('emplacements clavier « Deplacer vers… »', () => {
  it('offre n+1 emplacements en excluant la carte deplacee', () => {
    const slots = listCardDropSlots(ORDER, 'todo', 'b');
    expect(slots).toEqual([
      { index: 0, beforeCardId: 'a', previousCardId: null },
      { index: 1, afterCardId: 'a', previousCardId: 'a' },
      { index: 2, afterCardId: 'c', previousCardId: 'c' },
    ]);
  });

  it('offre un seul emplacement dans une colonne vide', () => {
    expect(listCardDropSlots(ORDER, 'done', 'b')).toEqual([{ index: 0, previousCardId: null }]);
  });

  it('renvoie une liste vide pour une colonne inconnue', () => {
    expect(listCardDropSlots(ORDER, 'absente', 'b')).toEqual([]);
  });

  it('preselectionne la position actuelle, ou la fin dans une autre colonne', () => {
    expect(currentCardSlotIndex(ORDER, 'todo', 'b')).toBe(1);
    expect(currentCardSlotIndex(ORDER, 'doing', 'b')).toBe(1);
    expect(currentCardSlotIndex(ORDER, 'done', 'b')).toBe(0);
    expect(currentCardSlotIndex(ORDER, 'absente', 'b')).toBe(0);
  });

  it('un emplacement redonne exactement la position d origine', () => {
    const slots = listCardDropSlots(ORDER, 'todo', 'b');
    const intent = slotToRequest('b', 'todo', slots[currentCardSlotIndex(ORDER, 'todo', 'b')]);
    expect(intent).toEqual({ cardId: 'b', columnId: 'todo', afterCardId: 'a' });
  });

  it('slotToRequest n emet que la cle utile', () => {
    expect(slotToRequest('b', 'done', { index: 0, previousCardId: null })).toEqual({
      cardId: 'b',
      columnId: 'done',
    });
  });
});

describe('safeLabelColor', () => {
  it('accepte un hexadecimal strict', () => {
    expect(safeLabelColor('#9A6B12')).toBe('#9A6B12');
    expect(safeLabelColor(' #abc ')).toBe('#abc');
    // Meme validateur que `lib/colors` (#89) : la forme a transparence passe
    // ici comme sur une tuile.
    expect(safeLabelColor('#9A6B12CC')).toBe('#9A6B12CC');
  });

  it('rejette tout le reste — une valeur libre dans `style` serait une faille', () => {
    expect(safeLabelColor('red')).toBeNull();
    expect(safeLabelColor('url(javascript:alert(1))')).toBeNull();
    expect(safeLabelColor('#12345')).toBeNull();
    expect(safeLabelColor(null)).toBeNull();
    expect(safeLabelColor(42)).toBeNull();
  });
});

describe('index des membres et des etiquettes', () => {
  it('resout nom et portrait, avec repli sur l id', () => {
    const index = indexMembers([
      { userId: 'u1', profile: { name: 'Amina Bakary', profilThumbImageUrl: '/a.jpg' } },
      { userId: 'u2', profile: null },
    ]);
    expect(index.get('u1')).toEqual({
      userId: 'u1',
      name: 'Amina Bakary',
      avatarUrl: '/a.jpg',
    });
    expect(index.get('u2')).toEqual({ userId: 'u2', name: 'u2', avatarUrl: null });
  });

  it('nettoie la couleur des etiquettes a l indexation', () => {
    const index = indexLabels([
      { id: 'l1', name: 'Logistique', color: '#9A6B12' },
      { id: 'l2', name: 'Com', color: 'expression(alert(1))' },
    ]);
    expect(index.get('l1')?.color).toBe('#9A6B12');
    expect(index.get('l2')?.color).toBeNull();
  });
});

describe('sameCardRequest / sameColumnRequest', () => {
  it('reconnait deux intentions identiques', () => {
    expect(
      sameCardRequest(
        { cardId: 'a', columnId: 'todo', afterCardId: 'b' },
        { cardId: 'a', columnId: 'todo', afterCardId: 'b' },
      ),
    ).toBe(true);
  });

  it('distingue colonne et voisins', () => {
    expect(
      sameCardRequest(
        { cardId: 'a', columnId: 'todo', afterCardId: 'b' },
        { cardId: 'a', columnId: 'doing', afterCardId: 'b' },
      ),
    ).toBe(false);
    expect(
      sameCardRequest(
        { cardId: 'a', columnId: 'todo', afterCardId: 'b' },
        { cardId: 'a', columnId: 'todo', beforeCardId: 'b' },
      ),
    ).toBe(false);
    expect(sameCardRequest(null, { cardId: 'a', columnId: 'todo' })).toBe(false);
    expect(sameCardRequest(null, null)).toBe(true);
  });

  it('compare les intentions de colonne sur leurs seuls voisins', () => {
    expect(
      sameColumnRequest({ columnId: 'a', afterColumnId: 'b' }, { columnId: 'a', afterColumnId: 'b' }),
    ).toBe(true);
    expect(
      sameColumnRequest({ columnId: 'a', afterColumnId: 'b' }, { columnId: 'a', afterColumnId: 'c' }),
    ).toBe(false);
  });
});

describe('shouldPlaceAfter', () => {
  it('depose apres la carte survolee une fois son milieu franchi', () => {
    expect(shouldPlaceAfter(120, 100, 40)).toBe(false);
    expect(shouldPlaceAfter(121, 100, 40)).toBe(true);
  });
});

describe('resolveColumnTitle', () => {
  const translate = (key: string, fallback: string) => (key === 'column.defaults.todo' ? 'To do' : fallback);

  it('traduit les trois colonnes par defaut', () => {
    expect(resolveColumnTitle({ title: 'A faire', titleKey: 'todo' }, translate)).toBe('To do');
  });

  it('traduit aussi les statuts d un board-lien : la langue de l interface, pas celle servie (#32)', () => {
    const catalog = (key: string, fallback: string) => (key.startsWith('column.defaults.') ? `[${key.slice(16)}]` : fallback);
    for (const key of ['next', 'tracking', 'totest', 'discuter']) {
      expect(resolveColumnTitle({ title: 'servi en francais', titleKey: key }, catalog)).toBe(`[${key}]`);
    }
  });

  it('retombe sur le titre stocke pour une colonne renommee', () => {
    expect(resolveColumnTitle({ title: 'Blocages', titleKey: null }, translate)).toBe('Blocages');
    expect(resolveColumnTitle({ title: 'Blocages' }, translate)).toBe('Blocages');
    expect(resolveColumnTitle({ title: 'X', titleKey: 'inattendu' }, translate)).toBe('X');
  });
});

/* ------------------------------------------------------------------------ */
/*  Garde-fous d'interface (rendu serveur)                                    */
/*                                                                            */
/*  Ces cas ne testent pas du style : ils verrouillent trois promesses que    */
/*  l'on ne peut pas tenir « par relecture » — la reglette annonce sa mesure, */
/*  un viewer n'a AUCUNE prise de deplacement, et rien n'est declare « en     */
/*  retard » au rendu serveur (sans quoi l'hydratation divergerait).          */
/* ------------------------------------------------------------------------ */

/** Echeance de `CARD`, nommee : les cas « en retard » en partent sans assertion `!`. */
const CARD_DUE = 1_700_000_000;

const CARD: Card = {
  _id: 'c1',
  boardId: 'b1',
  columnId: 'col1',
  rank: 1000,
  title: 'Commander le plan de travail',
  description: '',
  priority: 'urgent',
  assignees: [],
  labelIds: [],
  checklist: [],
  checklistDone: 0,
  checklistTotal: 0,
  status: 'not_started',
  links: [],
  linkCount: 0,
  commentCount: 0,
  dueDate: CARD_DUE,
  completedAt: null,
  creator: 'u1',
  created: 1,
  updated: 1,
};

const COLUMN: Column = {
  _id: 'col1',
  boardId: 'b1',
  title: 'À faire',
  titleKey: 'todo',
  rank: 1000,
  color: null,
  wipLimit: null,
  isDoneColumn: false,
  cardCount: 1,
  creator: 'u1',
  created: 1,
  updated: 1,
};

function renderTaskCard(canEdit: boolean, nowSeconds = 0, card: Card = CARD): string {
  return renderToString(
    // Le titre de la carte est le lien de sa fiche : il lui faut un routeur.
    createElement(
      MemoryRouter,
      null,
      createElement(
      DndContext,
      null,
      createElement(TaskCard, {
        card,
        columnId: 'col1',
        columns: [COLUMN],
        getCard: (cardId: string) => (cardId === card._id ? card : undefined),
        getCardOrder: () => ({ col1: [card._id] }),
        memberIndex: indexMembers([]),
        labelIndex: new Map(),
        nowSeconds,
        canEdit,
        onMove: () => {},
      }),
      ),
    ),
  );
}

/** Balise ouvrante de la fiche (`<article …>`), pour tester ce qu'elle porte — ou pas. */
function articleTag(html: string): string {
  const match = /<article[^>]*>/.exec(html);
  if (match === null) throw new Error('fiche introuvable');
  return match[0];
}

describe('rendu serveur — carte', () => {
  it('donne à l’éditeur une POIGNÉE clavier, sœur du contenu, annoncée en français', () => {
    const html = renderTaskCard(true);
    /*
     * La prise CLAVIER est la poignée : un vrai bouton, nommé par le titre,
     * qui porte les attributs de dnd-kit dès le rendu serveur — sans eux, un
     * clavier ne trouverait aucune prise le temps du chargement.
     */
    const handle = /<button[^>]*data-card-handle=""[^>]*>/.exec(html)?.[0] ?? '';
    expect(handle).toContain('aria-roledescription="carte déplaçable"');
    expect(handle).toContain('tabindex="0"');
    expect(handle).toContain('aria-label="Commander le plan de travail"');
    expect(html).toMatch(/data-card-handle=""[^>]*><svg[^>]*lucide-grip-vertical/);
    /*
     * Constat #83 : la FICHE n'est plus un `role="button"`. Elle contient le
     * lien du titre et des boutons — enfants qu'ARIA rend présentationnels
     * dans un bouton (règle axe « nested-interactive »).
     */
    expect(articleTag(html)).not.toContain('role=');
    expect(articleTag(html)).not.toContain('tabindex');
    // Le menu « Déplacer vers… » vit DANS le menu d'actions, donc hors du
    // rendu serveur : c'est `cardMoveAlternative.test.tsx` qui garde
    // l'alternative clavier en l'ouvrant pour de vrai. Ici, on garde ce que le
    // serveur doit rendre : la prise du menu, atteignable au clavier.
    expect(html).toContain('Actions de la carte Commander le plan de travail');
    expect(html).toContain('aria-haspopup="menu"');
  });

  it('ne laisse au viewer AUCUNE prise de déplacement', () => {
    const html = renderTaskCard(false);
    expect(html).not.toContain('Déplacer');
    expect(html).not.toContain('aria-roledescription');
    // Ni poignée, ni tabulation sur la fiche : un viewer ne doit pas se voir
    // offrir un `role="button"` qui ne ferait rien au clavier.
    expect(html).not.toContain('data-card-handle=""');
    expect(html).not.toContain('role="button"');
    expect(html).not.toContain('tabindex="0"');
    // Le contenu de la carte, lui, reste entier.
    expect(html).toContain('Commander le plan de travail');
  });

  it('n’affiche aucun retard tant que l’instant est inconnu (parité SSR)', () => {
    // Insensible à la casse : le libellé rendu est « En retard » (début de
    // segment), et cette assertion garde la PRÉSENCE du mot, pas sa typographie.
    expect(renderTaskCard(true, 0)).not.toMatch(/en retard/i);
    expect(renderTaskCard(true, CARD_DUE + 86_400 * 3)).toMatch(/en retard/i);
  });

  /*
   * Constat #33 : « En retard » se décide au JOUR civil (RG-25), comme le
   * filtre « Échéance » et les autres vues. Une échéance du jour (minuit UTC)
   * consultée à 10 h n'est pas en retard — elle l'était, à la seconde près.
   */
  it('n’affiche pas « En retard » le jour même de l’échéance, l’affiche le lendemain', () => {
    const dueToday: Card = { ...CARD, dueDate: Date.UTC(2026, 9, 22) / 1000 };
    expect(renderTaskCard(true, Date.UTC(2026, 9, 22, 10) / 1000, dueToday)).not.toMatch(/en retard/i);
    expect(renderTaskCard(true, Date.UTC(2026, 9, 23, 0, 0, 1) / 1000, dueToday)).toMatch(/en retard/i);
  });

  it('ne dit jamais « En retard » d’une carte close, même sans date de clôture', () => {
    // Action Communecter close avant l'historique : `completedAt` est null (E11).
    const closed: Card = { ...CARD, status: 'complete', completedAt: null };
    expect(renderTaskCard(true, CARD_DUE + 86_400 * 3, closed)).not.toMatch(/en retard/i);
  });
});
