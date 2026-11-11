/**
 * Selecteurs de synthese (`src/lib/boardStats.ts`).
 *
 * Ce que ces tests protegent : les cartouches de la vue d'ensemble sont lus
 * comme des faits (« 3 en retard »). Une carte comptee deux fois, un `NaN`
 * affiche en pourcentage ou un retard qui persiste apres cloture ne se voient
 * pas a l'oeil sur un tableau de dix cartes — mais faussent la lecture de tout
 * le tableau de bord.
 */
import { describe, expect, test } from 'vitest';
import {
  boardProgress,
  boardStats,
  columnBreakdown,
  contributorLoad,
  dueThisWeekCards,
  isCardDone,
  isCardOverdue,
  overdueCards,
  percentOf,
  statusBreakdown,
  unassignedCards,
} from '@/modules/kanban/lib/boardStats';
import { DAY, NOW, makeAction, makeCard, makeColumn, makeLinkSnapshot, makeSnapshot } from '../__fixtures__/snapshot';

const SNAPSHOT = makeSnapshot({
  columns: [
    makeColumn('todo', 1000),
    makeColumn('doing', 2000),
    makeColumn('done', 3000, { isDoneColumn: true }),
  ],
  cards: [
    // En retard, assignee a Alice.
    makeCard('c1', 'todo', { rank: 1000, dueDate: NOW - 3 * DAY, assignees: ['u1'] }),
    // A echeance demain, assignee aux deux.
    makeCard('c2', 'todo', { rank: 2000, dueDate: NOW + DAY, assignees: ['u1', 'u2'], status: 'in_research' }),
    // Sans echeance ni assigne.
    makeCard('c3', 'doing', { rank: 1000, status: 'on_track' }),
    // Close : ni en retard, ni a echeance, malgre une date passee.
    makeCard('c4', 'done', {
      rank: 1000,
      status: 'complete',
      completedAt: NOW - DAY,
      dueDate: NOW - 5 * DAY,
      assignees: ['u2'],
    }),
  ],
});

describe('percentOf', () => {
  test('ne rend jamais NaN sur un tableau vide', () => {
    // Un `0/0` affiche « NaN % » dans le cartouche d'avancement : c'est le
    // premier etat qu'on voit sur un tableau tout neuf.
    expect(percentOf(0, 0)).toBe(0);
    expect(percentOf(1, 3)).toBe(33);
  });
});

describe('isCardDone', () => {
  test('suit ce que le serveur a tranche, jamais la colonne', () => {
    expect(isCardDone(makeCard('x', 'todo', { completedAt: NOW }))).toBe(true);
    expect(isCardDone(makeCard('x', 'todo', { status: 'complete' }))).toBe(true);
    // Une carte posee dans la colonne de cloture mais que le serveur n'a pas
    // encore close ne compte pas : deux ecrans afficheraient sinon deux
    // avancements differents pour le meme tableau.
    expect(isCardDone(makeCard('x', 'done', { status: 'on_track' }))).toBe(false);
  });
});

describe('isCardOverdue', () => {
  test('echeance passee ET carte non close (RG-25), completedAt nul compris', () => {
    expect(isCardOverdue(makeCard('x', 'todo', { dueDate: NOW - DAY, completedAt: null }), NOW)).toBe(true);
    // Action « Terminé » close avant l'historique : `completedAt` nul, statut clos.
    expect(
      isCardOverdue(makeCard('x', 'done', { dueDate: NOW - DAY, completedAt: null, status: 'complete' }), NOW),
    ).toBe(false);
    expect(isCardOverdue(makeCard('x', 'todo', { dueDate: NOW, completedAt: null }), NOW)).toBe(false);
    expect(isCardOverdue(makeCard('x', 'todo', { dueDate: null, completedAt: null }), NOW)).toBe(false);
  });
});

describe('boardProgress', () => {
  test('compte les cartes closes sur le total', () => {
    expect(boardProgress(SNAPSHOT)).toEqual({ total: 4, done: 1, percent: 25 });
  });

  test('tableau vide : 0 %, pas de division par zero', () => {
    expect(boardProgress(makeSnapshot())).toEqual({ total: 0, done: 0, percent: 0 });
  });
});

describe('echeances', () => {
  test('une carte close n echoit plus, meme en retard (RG-25)', () => {
    expect(overdueCards(SNAPSHOT, NOW).map((card) => card._id)).toEqual(['c1']);
  });

  test('« cette semaine » exclut le retard : aucune carte comptee deux fois', () => {
    const thisWeek = dueThisWeekCards(SNAPSHOT, NOW).map((card) => card._id);
    expect(thisWeek).toEqual(['c2']);
    expect(thisWeek).not.toContain('c1');
  });

  test('une echeance a plus de sept jours sort de la fenetre', () => {
    const snapshot = makeSnapshot({
      columns: [makeColumn('todo', 1000)],
      cards: [makeCard('c1', 'todo', { dueDate: NOW + 8 * DAY })],
    });
    expect(dueThisWeekCards(snapshot, NOW)).toEqual([]);
  });
});

describe('unassignedCards', () => {
  test('ne garde que les cartes que personne n a prises', () => {
    expect(unassignedCards(SNAPSHOT).map((card) => card._id)).toEqual(['c3']);
  });
});

describe('columnBreakdown', () => {
  test('suit l ordre du tableau et compte les closes par colonne', () => {
    expect(
      columnBreakdown(SNAPSHOT).map((entry) => [entry.column._id, entry.total, entry.done, entry.percent]),
    ).toEqual([
      ['todo', 2, 0, 0],
      ['doing', 1, 0, 0],
      ['done', 1, 1, 100],
    ]);
  });

  test('deux colonnes de meme rang gardent un ordre stable (`_id`)', () => {
    const snapshot = makeSnapshot({
      columns: [makeColumn('zeta', 1000), makeColumn('alpha', 1000)],
    });
    expect(columnBreakdown(snapshot).map((entry) => entry.column._id)).toEqual(['alpha', 'zeta']);
  });
});

describe('statusBreakdown', () => {
  test('les quatre statuts sont toujours presents, zero compris', () => {
    expect(statusBreakdown(SNAPSHOT)).toEqual([
      { status: 'not_started', total: 1, percent: 25 },
      { status: 'in_research', total: 1, percent: 25 },
      { status: 'on_track', total: 1, percent: 25 },
      { status: 'complete', total: 1, percent: 25 },
    ]);
  });

  test('tableau relié : les trois statuts d’une action Communecter, jamais « en recherche »', () => {
    const linked = makeLinkSnapshot({ cards: [makeAction('a1', 'todo'), makeAction('a2', 'tracking'), makeAction('a3', 'done')] });
    expect(statusBreakdown(linked).map((entry) => [entry.status, entry.total])).toEqual([
      ['not_started', 1],
      ['on_track', 1],
      ['complete', 1],
    ]);
  });
});

describe('contributorLoad', () => {
  test('une carte a deux assignes compte pour chacun', () => {
    const load = contributorLoad(SNAPSHOT, NOW);
    expect(load.map((entry) => [entry.userId, entry.total, entry.done, entry.overdue])).toEqual([
      ['u1', 2, 0, 1],
      ['u2', 2, 1, 0],
    ]);
  });

  test('un membre sans aucune carte reste dans la liste', () => {
    const snapshot = makeSnapshot({ columns: [makeColumn('todo', 1000)], cards: [] });
    expect(contributorLoad(snapshot, NOW).map((entry) => [entry.userId, entry.total])).toEqual([
      ['u1', 0],
      ['u2', 0],
    ]);
  });

  test('un assigne qui n est plus membre apparait sans profil', () => {
    const snapshot = makeSnapshot({
      columns: [makeColumn('todo', 1000)],
      cards: [makeCard('c1', 'todo', { assignees: ['fantome'] })],
    });
    const ghost = contributorLoad(snapshot, NOW).find((entry) => entry.userId === 'fantome');
    // Ses cartes existent encore : les taire ferait disparaitre du travail.
    expect(ghost).toMatchObject({ total: 1, member: null });
  });
});

describe('boardStats', () => {
  test('agrege tout en un passage, sans recalcul divergent', () => {
    const stats = boardStats(SNAPSHOT, NOW);
    expect(stats.progress).toEqual(boardProgress(SNAPSHOT));
    expect(stats.overdue.map((card) => card._id)).toEqual(['c1']);
    expect(stats.dueThisWeek.map((card) => card._id)).toEqual(['c2']);
    expect(stats.unassigned.map((card) => card._id)).toEqual(['c3']);
    expect(stats.byColumn).toHaveLength(3);
    expect(stats.byStatus).toHaveLength(4);
    expect(stats.byContributor).toHaveLength(2);
  });
});
