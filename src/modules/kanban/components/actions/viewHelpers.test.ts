/**
 * Helpers des vues du tableau des actions, repris de co-kanban (`tests/unit/viewHelpers.test.ts`) :
 * regroupements de la Liste, axe des semaines de la chronologie ; et le tri partagé par la Liste
 * et la Table.
 */
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { makeAction, makeCard } from '@/modules/kanban/__fixtures__/snapshot';
import {
  buildWeekAxis,
  groupCards,
  MAX_GAP_FILL_WEEKS,
  orderCards,
  SECONDS_PER_WEEK,
  shellSortKeyFor,
  sortCards,
  startOfWeek,
  tableSortFromShell,
  type CardSortContext,
} from './viewHelpers';

const CONTEXT = { columnIds: ['todo', 'done'], memberIds: ['u1', 'u2'], statuses: ['not_started', 'on_track', 'complete'] as const };

describe('groupCards par priorité', () => {
  test('« Sans priorité » vient en DERNIER, et seulement s’il porte des cartes', () => {
    const cards = [makeAction('a1', 'todo'), makeAction('a2', 'todo', { priority: 'urgent' })];
    const groups = groupCards(cards, 'priority', CONTEXT);
    const last = groups[groups.length - 1];
    expect(last).toMatchObject({ id: 'priority-none', kind: 'priority', priority: null });
    expect(last.cards.map((card) => card._id)).toEqual(['a1']);
    expect(groups.find((group) => group.kind === 'priority' && group.priority === 'urgent')?.cards).toHaveLength(1);
  });

  test('toutes les cartes ont une priorité : pas de groupe « Sans priorité », les quatre niveaux restent', () => {
    const groups = groupCards([makeCard('c1', 'todo')], 'priority', CONTEXT);
    expect(groups.some((group) => group.id === 'priority-none')).toBe(false);
    expect(groups).toHaveLength(4);
  });
});

describe('groupCards, autres axes', () => {
  const cards = [makeCard('c1', 'todo', { assignees: ['u1', 'u2'], status: 'on_track' }), makeCard('c2', 'done', { status: 'complete' })];

  test('par colonne : un groupe par colonne, vides compris', () => {
    expect(groupCards(cards, 'column', CONTEXT).map((group) => group.cards.length)).toEqual([1, 1]);
  });

  test('par statut : les statuts du tableau seulement (trois pour une action Communecter), vides compris', () => {
    const groups = groupCards(cards, 'status', CONTEXT);
    expect(groups.map((group) => (group.kind === 'status' ? group.status : null))).toEqual(['not_started', 'on_track', 'complete']);
    expect(groups.map((group) => group.cards.length)).toEqual([0, 1, 1]);
  });

  test('par assigné : une carte à deux personnes compte pour chacune, la file non assignée en dernier', () => {
    const groups = groupCards(cards, 'assignee', CONTEXT);
    expect(groups.map((group) => group.cards.map((card) => card._id))).toEqual([['c1'], ['c1'], ['c2']]);
    expect(groups[groups.length - 1]).toMatchObject({ kind: 'assignee', userId: null });
  });

  test('sans regroupement : un seul groupe, dans l’ordre reçu', () => {
    expect(groupCards(cards, 'none', CONTEXT)).toEqual([{ id: 'all', kind: 'none', cards }]);
  });
});

/* -------------------------------------------------------------------------- */
/*  Tri                                                                       */
/* -------------------------------------------------------------------------- */

describe('tri des cartes', () => {
  const context: CardSortContext = {
    columnOrder: new Map([
      ['todo', 0],
      ['done', 1],
    ]),
    memberNames: new Map([
      ['u1', 'Zoé'],
      ['u2', 'Amine'],
    ]),
  };
  const early = makeCard('c1', 'done', { title: 'Banderole', dueDate: 100, priority: 'low', assignees: ['u1'] });
  const late = makeCard('c2', 'todo', { title: 'Affiche', dueDate: 200, priority: 'urgent', assignees: ['u2'] });
  const undated = makeCard('c3', 'todo', { title: 'Courrier', dueDate: null, priority: 'medium', assignees: [] });

  test('l’échéance croissante met les cartes sans échéance à la fin ; décroissante, au début', () => {
    expect(sortCards([undated, late, early], { key: 'dueDate', direction: 'asc' }, context).map((card) => card._id)).toEqual(['c1', 'c2', 'c3']);
    expect(sortCards([undated, late, early], { key: 'dueDate', direction: 'desc' }, context).map((card) => card._id)).toEqual(['c3', 'c2', 'c1']);
  });

  test('par assigné : sur le nom affiché, la file non assignée à la fin', () => {
    expect(sortCards([early, undated, late], { key: 'assignees', direction: 'asc' }, context).map((card) => card._id)).toEqual(['c2', 'c1', 'c3']);
  });

  test('par colonne : l’ordre du tableau ; à égalité, l’identifiant départage', () => {
    expect(sortCards([early, undated, late], { key: 'column', direction: 'asc' }, context).map((card) => card._id)).toEqual(['c2', 'c3', 'c1']);
  });

  test('« Ordre du tableau » garde l’entrée, inversée en décroissant', () => {
    expect(orderCards([early, late], 'rank', 'desc', context)).toEqual([late, early]);
    expect(orderCards([early, late], 'priority', 'desc', context)).toEqual([late, early]);
  });

  test('pont entre « Trier » et les en-têtes de la table', () => {
    expect(tableSortFromShell('rank', 'asc')).toEqual({ key: 'column', direction: 'asc' });
    expect(tableSortFromShell('dueDate', 'desc')).toEqual({ key: 'dueDate', direction: 'desc' });
    expect(shellSortKeyFor('column')).toBe('rank');
    expect(shellSortKeyFor('priority')).toBe('priority');
    // Colonne propre à la table : la barre ne la connaît pas.
    expect(shellSortKeyFor('comments')).toBeNull();
  });
});

/* -------------------------------------------------------------------------- */
/*  Axe des semaines de la chronologie                                        */
/* -------------------------------------------------------------------------- */

const MONDAY_OCT_19 = Date.UTC(2026, 9, 19) / 1000;

describe('startOfWeek', () => {
  test('lundi 00:00 de la semaine, en UTC par défaut', () => {
    expect(startOfWeek(MONDAY_OCT_19)).toBe(MONDAY_OCT_19);
    expect(startOfWeek(Date.UTC(2026, 9, 25, 23, 59) / 1000)).toBe(MONDAY_OCT_19);
    expect(startOfWeek(Date.UTC(2026, 9, 26) / 1000)).toBe(MONDAY_OCT_19 + SECONDS_PER_WEEK);
  });
});

describe('semaines d’un tableau relié : jour civil du navigateur', () => {
  const previousZone = process.env.TZ;
  beforeAll(() => {
    process.env.TZ = 'Indian/Reunion';
  });
  afterAll(() => {
    if (previousZone === undefined) delete process.env.TZ;
    else process.env.TZ = previousZone;
  });

  // Dimanche 25/10 20:00 UTC = lundi 26/10 00:00 à La Réunion, comme gestion la saisit.
  const MONDAY_MIDNIGHT_LOCAL = Date.UTC(2026, 9, 25, 20) / 1000;

  test('une échéance du lundi à minuit locale tombe dans SA semaine, pas dans la précédente', () => {
    expect(startOfWeek(MONDAY_MIDNIGHT_LOCAL, 'local')).toBe(MONDAY_OCT_19 + SECONDS_PER_WEEK);
    expect(startOfWeek(MONDAY_MIDNIGHT_LOCAL)).toBe(MONDAY_OCT_19);
  });

  test('l’axe et la semaine courante suivent la même zone', () => {
    const axis = buildWeekAxis([MONDAY_MIDNIGHT_LOCAL], MONDAY_MIDNIGHT_LOCAL, 'local');
    expect(axis).toEqual([{ start: MONDAY_OCT_19 + SECONDS_PER_WEEK, gapBefore: false }]);
  });
});

describe('buildWeekAxis', () => {
  test('les trous courts sont comblés, les longs signalés', () => {
    const shortGap = buildWeekAxis([MONDAY_OCT_19, MONDAY_OCT_19 + 3 * SECONDS_PER_WEEK], 0);
    expect(shortGap.map((week) => week.start)).toEqual([0, 1, 2, 3].map((n) => MONDAY_OCT_19 + n * SECONDS_PER_WEEK));
    const far = MONDAY_OCT_19 + (MAX_GAP_FILL_WEEKS + 2) * SECONDS_PER_WEEK;
    expect(buildWeekAxis([MONDAY_OCT_19, far], 0)).toEqual([
      { start: MONDAY_OCT_19, gapBefore: false },
      { start: far, gapBefore: true },
    ]);
  });

  test('horloge inconnue (rendu serveur) : la semaine courante n’est pas ajoutée', () => {
    expect(buildWeekAxis([], 0)).toEqual([]);
    expect(buildWeekAxis([], MONDAY_OCT_19)).toEqual([{ start: MONDAY_OCT_19, gapBefore: false }]);
  });
});
