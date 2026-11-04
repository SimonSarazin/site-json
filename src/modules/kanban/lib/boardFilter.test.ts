/**
 * Filtrage et recherche (`src/lib/boardFilter.ts`).
 *
 * Ce que ces tests protegent : la recherche de la barre applicative, le
 * popover de filtres, la table et la chronologie lisent TOUS cette fonction.
 * Un accent mal normalise, un OU pris pour un ET, ou un ordre de sortie
 * instable se traduisent a l'ecran par « la carte a disparu » — le pire des
 * symptomes, parce que rien ne l'explique.
 */
import { describe, expect, test } from 'vitest';
import {
  boardFilterOptions,
  countActiveFilters,
  filterCards,
  filterCardsByColumn,
  isFilterActive,
  matchesDueWindowFilter,
  milestoneFilterValue,
  NO_MILESTONE_FILTER,
  normalizeSearchText,
} from '@/modules/kanban/lib/boardFilter';
import { overdueCards } from '@/modules/kanban/lib/boardStats';
import {
  DAY,
  MILESTONES,
  NOW,
  makeAction,
  makeCard,
  makeColumn,
  makeLinkSnapshot,
  makeSnapshot,
} from '../__fixtures__/snapshot';

const SNAPSHOT = makeSnapshot({
  columns: [
    makeColumn('todo', 1000),
    makeColumn('doing', 2000),
    makeColumn('done', 3000, { isDoneColumn: true }),
  ],
  cards: [
    makeCard('c1', 'todo', {
      rank: 2000,
      title: 'Réunion de chantier',
      description: 'Préparer le point hebdomadaire',
      priority: 'high',
      status: 'in_research',
      assignees: ['u1'],
      labelIds: ['lbl_logistique'],
      dueDate: NOW - 2 * DAY,
    }),
    makeCard('c2', 'todo', {
      rank: 1000,
      title: 'Commander le plan de travail',
      priority: 'low',
      status: 'not_started',
      labelIds: ['lbl_budget'],
    }),
    makeCard('c3', 'doing', {
      rank: 1000,
      title: 'Devis inox',
      priority: 'urgent',
      status: 'on_track',
      assignees: ['u2'],
    }),
    makeCard('c4', 'done', {
      rank: 1000,
      title: 'Nettoyage',
      status: 'complete',
      completedAt: NOW - DAY,
      dueDate: NOW - 5 * DAY,
      assignees: ['u1'],
    }),
  ],
});

const ids = (cards: { _id: string }[]) => cards.map((card) => card._id);

describe('normalizeSearchText', () => {
  test('retire les accents et la casse', () => {
    expect(normalizeSearchText('Réunion')).toBe('reunion');
    expect(normalizeSearchText('ÉCHÉANCE')).toBe('echeance');
  });
});

describe('filterCards — recherche libre', () => {
  test('sans critere, rend tout dans l ordre du tableau', () => {
    // Colonne par rang, puis carte par rang : `c2` (rang 1000) precede `c1`.
    expect(ids(filterCards(SNAPSHOT))).toEqual(['c2', 'c1', 'c3', 'c4']);
  });

  test('trouve « Réunion » en tapant « reunion »', () => {
    expect(ids(filterCards(SNAPSHOT, { text: 'reunion' }, NOW))).toEqual(['c1']);
  });

  test('cherche aussi dans la description et dans le NOM des etiquettes', () => {
    expect(ids(filterCards(SNAPSHOT, { text: 'hebdomadaire' }, NOW))).toEqual(['c1']);
    // L'utilisateur tape « budget », pas `lbl_budget`.
    expect(ids(filterCards(SNAPSHOT, { text: 'budget' }, NOW))).toEqual(['c2']);
  });

  test('une recherche faite d espaces ne filtre rien', () => {
    expect(ids(filterCards(SNAPSHOT, { text: '   ' }, NOW))).toHaveLength(4);
  });

  /*
   * Le texte indexe est memoise par objet carte (#52). Il doit suivre ce qui
   * change SANS changer la carte : le nom d'une etiquette, renomme dans les
   * reglages du tableau (nouvelle liste de libelles, memes objets carte).
   */
  test('memoire du texte indexe : un libelle renomme est retrouve, l ancien nom ne l est plus', () => {
    expect(ids(filterCards(SNAPSHOT, { text: 'budget' }, NOW))).toEqual(['c2']);
    const renamed = {
      ...SNAPSHOT,
      board: {
        ...SNAPSHOT.board,
        labels: SNAPSHOT.board.labels.map((label) => (label.id === 'lbl_budget' ? { ...label, name: 'Finances' } : label)),
      },
    };
    expect(ids(filterCards(renamed, { text: 'finances' }, NOW))).toEqual(['c2']);
    expect(ids(filterCards(renamed, { text: 'budget' }, NOW))).toEqual([]);
    // Une carte modifiee est un nouvel objet : son nouveau titre est indexe.
    const retitled = { ...SNAPSHOT, cards: SNAPSHOT.cards.map((card) => (card._id === 'c3' ? { ...card, title: 'Inventaire' } : card)) };
    expect(ids(filterCards(retitled, { text: 'inventaire' }, NOW))).toEqual(['c3']);
  });
});

describe('filterCards — criteres', () => {
  test('les listes sont des OU internes', () => {
    expect(ids(filterCards(SNAPSHOT, { priorities: ['high', 'urgent'] }, NOW))).toEqual(['c1', 'c3']);
    expect(ids(filterCards(SNAPSHOT, { statuses: ['complete'] }, NOW))).toEqual(['c4']);
  });

  test('les criteres se cumulent en ET', () => {
    expect(ids(filterCards(SNAPSHOT, { priorities: ['high'], assignees: ['u2'] }, NOW))).toEqual([]);
    expect(ids(filterCards(SNAPSHOT, { priorities: ['high'], assignees: ['u1'] }, NOW))).toEqual(['c1']);
  });

  test('« non assignees » se cumule en OU avec un assigne choisi', () => {
    // Demander « les cartes de u2, plus celles que personne n'a prises ».
    expect(ids(filterCards(SNAPSHOT, { assignees: ['u2'], unassigned: true }, NOW))).toEqual(['c2', 'c3']);
    expect(ids(filterCards(SNAPSHOT, { unassigned: true }, NOW))).toEqual(['c2']);
  });

  test('« en retard » exclut les cartes closes (RG-25)', () => {
    // `c4` a une echeance depassee mais elle est close : la compter en retard
    // ferait un tableau perpetuellement rouge.
    expect(ids(filterCards(SNAPSHOT, { overdue: true }, NOW))).toEqual(['c1']);
  });

  test('« en cours seulement » ecarte ce que le serveur a clos', () => {
    expect(ids(filterCards(SNAPSHOT, { openOnly: true }, NOW))).toEqual(['c2', 'c1', 'c3']);
  });

  test('une etiquette retenue suffit', () => {
    expect(ids(filterCards(SNAPSHOT, { labelIds: ['lbl_logistique', 'lbl_inconnue'] }, NOW))).toEqual(['c1']);
  });

  test('filtrer par colonne', () => {
    expect(ids(filterCards(SNAPSHOT, { columnIds: ['doing'] }, NOW))).toEqual(['c3']);
  });
});

describe('countActiveFilters / isFilterActive', () => {
  test('un critere vide ne compte pas', () => {
    expect(countActiveFilters({})).toBe(0);
    expect(countActiveFilters({ assignees: [], priorities: [] })).toBe(0);
    expect(isFilterActive({})).toBe(false);
  });

  test('la recherche libre n est pas comptee comme un filtre', () => {
    // Elle a son propre champ visible : la compter afficherait « 1 filtre » a
    // quelqu'un qui n'a jamais ouvert le popover.
    expect(countActiveFilters({ text: 'devis' })).toBe(0);
    expect(countActiveFilters({ text: 'devis', overdue: true, priorities: ['high'] })).toBe(2);
  });
});

describe('filterCardsByColumn', () => {
  test('toute colonne est presente, meme vidée par le filtre', () => {
    const grouped = filterCardsByColumn(SNAPSHOT, { priorities: ['urgent'] }, NOW);
    expect([...grouped.keys()]).toEqual(['todo', 'doing', 'done']);
    expect(ids(grouped.get('todo') ?? [])).toEqual([]);
    expect(ids(grouped.get('doing') ?? [])).toEqual(['c3']);
  });

  test('une carte orpheline n invente pas de colonne', () => {
    const snapshot = makeSnapshot({
      columns: [makeColumn('todo', 1000)],
      cards: [makeCard('c1', 'todo'), makeCard('c9', 'colonne-disparue')],
    });
    const grouped = filterCardsByColumn(snapshot, {}, NOW);
    expect([...grouped.keys()]).toEqual(['todo']);
    expect(ids(grouped.get('todo') ?? [])).toEqual(['c1']);
  });
});

/* -------------------------------------------------------------------------- */
/*  Filtres de la maquette (§11) : echeance, jalons, « sans priorite »        */
/* -------------------------------------------------------------------------- */

const LINK = makeLinkSnapshot({
  cards: [
    makeAction('a1', 'todo', { title: 'Agenda : état vide', dueDate: NOW, tags: ['Agenda'], labelIds: ['tag:Agenda'] }),
    makeAction('a2', 'todo', { priority: 'urgent', dueDate: NOW - 2 * DAY, milestone: { milestoneId: MILESTONES[1].milestoneId, name: 'V1.2', status: 'open' } }),
    makeAction('a3', 'tracking', { dueDate: NOW + 3 * DAY, assignees: ['u2'] }),
    makeAction('a4', 'done', { dueDate: NOW + DAY, milestone: { milestoneId: MILESTONES[0].milestoneId, name: 'V1.1', status: 'close' } }),
    makeAction('a5', 'next', { dueDate: NOW + 30 * DAY }),
  ],
});

describe('filterCards — echeance par fenetre', () => {
  test('en retard : echeance passee, carte non close', () => {
    expect(ids(filterCards(LINK, { dueWindows: ['overdue'] }, NOW))).toEqual(['a2']);
  });

  test('aujourd hui et cette semaine (7 jours, aujourd hui compris) excluent les cartes closes', () => {
    expect(ids(filterCards(LINK, { dueWindows: ['today'] }, NOW))).toEqual(['a1']);
    expect(ids(filterCards(LINK, { dueWindows: ['week'] }, NOW)).sort()).toEqual(['a1', 'a3']);
  });

  test('sans echeance, et cumul en OU', () => {
    const withoutDue = makeLinkSnapshot({ cards: [makeAction('n1', 'todo'), makeAction('n2', 'todo', { dueDate: NOW })] });
    expect(ids(filterCards(withoutDue, { dueWindows: ['none'] }, NOW))).toEqual(['n1']);
    expect(ids(filterCards(withoutDue, { dueWindows: ['none', 'today'] }, NOW)).sort()).toEqual(['n1', 'n2']);
  });

  test('matchesDueWindowFilter sans horloge implicite', () => {
    const card = { dueDate: NOW + 6 * DAY, completedAt: null, status: 'not_started' as const };
    expect(matchesDueWindowFilter(card, 'week', NOW)).toBe(true);
    expect(matchesDueWindowFilter(card, 'week', NOW - 2 * DAY)).toBe(false);
  });

  test('« cette semaine » = 7 jours, aujourd hui compris : J+6 dedans, J+7 dehors', () => {
    const at = (days: number) => ({ dueDate: NOW + days * DAY, completedAt: null, status: 'not_started' as const });
    expect(matchesDueWindowFilter(at(6), 'week', NOW)).toBe(true);
    expect(matchesDueWindowFilter(at(7), 'week', NOW)).toBe(false);
  });

  /*
   * RG-25 sur un board-lien : une action « Terminé » close AVANT l'historique
   * n'a pas de `completedAt` (§11.9 E11) — 91 % des actions terminees en base.
   * Elle n'est jamais en retard, ni dans la fenetre, ni dans le critere, ni
   * dans le compteur du popover, comme dans la vue d'ensemble.
   */
  const CLOSED = makeLinkSnapshot({
    cards: [
      ...LINK.cards,
      makeAction('a6', 'done', { dueDate: NOW - 3 * DAY }),
      makeAction('a7', 'done', { dueDate: NOW - 3 * DAY, completedAt: null }),
    ],
  });

  test('une carte close n est jamais en retard, completedAt nul ou non', () => {
    expect(ids(filterCards(CLOSED, { dueWindows: ['overdue'] }, NOW))).toEqual(['a2']);
    expect(ids(filterCards(CLOSED, { overdue: true }, NOW))).toEqual(['a2']);
    // Garde explicite plutot qu'une assertion `!` : une fixture modifiee echoue
    // ICI, en nommant la carte, et non sur une lecture de `undefined`.
    const closedWithoutDate = CLOSED.cards.find((card) => card._id === 'a7');
    if (!closedWithoutDate) throw new Error('carte a7 absente du jeu CLOSED');
    expect(matchesDueWindowFilter(closedWithoutDate, 'overdue', NOW)).toBe(false);
  });

  test('le compteur « En retard » du popover est celui de la vue d ensemble', () => {
    const overdueOption = boardFilterOptions(CLOSED, NOW).dueWindows.find((option) => option.value === 'overdue');
    expect(overdueOption?.count).toBe(overdueCards(CLOSED, NOW).length);
    expect(overdueOption?.count).toBe(1);
  });
});

describe('filterCards — jalons, priorite « aucune », tags', () => {
  test('par jalon, et « sans jalon » par la sentinelle', () => {
    expect(ids(filterCards(LINK, { milestoneIds: [MILESTONES[1].milestoneId] }, NOW))).toEqual(['a2']);
    expect(ids(filterCards(LINK, { milestoneIds: [NO_MILESTONE_FILTER] }, NOW)).sort()).toEqual(['a1', 'a3', 'a5']);
  });

  test('« sans priorite » est un choix comme un autre, cumulable', () => {
    expect(ids(filterCards(LINK, { priorities: ['urgent'] }, NOW))).toEqual(['a2']);
    expect(ids(filterCards(LINK, { priorities: ['none'] }, NOW)).sort()).toEqual(['a1', 'a3', 'a4', 'a5']);
  });

  test('la recherche trouve un tag, meme sans etiquette dans l instantane', () => {
    expect(ids(filterCards(LINK, { text: 'agenda' }, NOW))).toEqual(['a1']);
    expect(milestoneFilterValue(LINK.cards[0])).toBe(NO_MILESTONE_FILTER);
  });

  test('checklist hors index : une carte tronquee par le budget de board/get se cherche comme les autres', () => {
    // Meme carte, servie complete puis tronquee (§11.9 E29) : meme resultat.
    const complete = makeAction('t1', 'todo', {
      title: 'Préparer le forum',
      checklist: [{ id: 'k1', label: 'Réserver la salle', done: false }],
      checklistTotal: 1,
    });
    const truncated = { ...complete, checklist: [], checklistTruncated: true };
    for (const card of [complete, truncated]) {
      const snapshot = makeLinkSnapshot({ cards: [card] });
      expect(ids(filterCards(snapshot, { text: 'forum' }, NOW))).toEqual(['t1']);
      expect(ids(filterCards(snapshot, { text: 'salle' }, NOW))).toEqual([]);
    }
  });

  test('les nouveaux criteres comptent dans la pastille', () => {
    expect(countActiveFilters({ dueWindows: ['today'], milestoneIds: ['m'], priorities: ['none'] })).toBe(3);
    expect(countActiveFilters({ dueWindows: [], milestoneIds: [] })).toBe(0);
  });
});

describe('boardFilterOptions — les choix des popovers', () => {
  test('board-lien : « sans priorite », statuts derives, jalons ouverts puis clos, « sans jalon »', () => {
    const options = boardFilterOptions(LINK, NOW);
    expect(options.priorities.map((option) => option.value)).toEqual(['urgent', 'high', 'medium', 'low', 'none']);
    expect(options.priorities.find((option) => option.value === 'none')?.count).toBe(4);
    expect(options.statuses.map((option) => option.value)).toEqual(['not_started', 'on_track', 'complete']);
    expect(options.milestones.map((option) => option.value)).toEqual([
      MILESTONES[1].milestoneId,
      MILESTONES[0].milestoneId,
      NO_MILESTONE_FILTER,
    ]);
    expect(options.dueWindows).toEqual([
      { value: 'overdue', count: 1 },
      { value: 'today', count: 1 },
      { value: 'week', count: 2 },
      { value: 'none', count: 0 },
    ]);
  });

  test('assignes : membres d abord avec leur compteur, puis les inconnus ; non assignees', () => {
    const options = boardFilterOptions(
      makeSnapshot({
        columns: [makeColumn('todo', 1000)],
        cards: [makeCard('k1', 'todo', { assignees: ['u2', 'ancien'] }), makeCard('k2', 'todo')],
      }),
      NOW,
    );
    expect(options.assignees.map((option) => [option.userId, option.count])).toEqual([
      ['u1', 0],
      ['u2', 1],
      ['ancien', 1],
    ]);
    expect(options.assignees[2].member).toBeNull();
    expect(options.unassignedCount).toBe(1);
  });

  test('board kanban : pas de « sans priorite » ni de jalons, etiquettes du tableau comptees', () => {
    const options = boardFilterOptions(SNAPSHOT, NOW);
    expect(options.priorities.some((option) => option.value === 'none')).toBe(false);
    expect(options.milestones).toEqual([]);
    expect(options.labels.map((option) => [option.label.id, option.count])).toEqual([
      ['lbl_logistique', 1],
      ['lbl_budget', 1],
    ]);
    expect(options.statuses.map((option) => option.value)).toContain('in_research');
  });
});
