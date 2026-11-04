import { describe, expect, test } from 'vitest';
import {
  adjustCardCommentCount,
  applyActivities,
  applyRankUpdates,
  buildOptimisticCard,
  cardPatchFromUpdate,
  commentThreadsTouched,
  decideRollback,
  decideSync,
  markCardCommentsSeen,
  rolesTouched,
  setMilestones,
  upsertMilestone,
  setCardCommentCount,
  statusForColumn,
  moveCardInSnapshot,
  patchCard,
  patchColumn,
  removeCard,
  removeColumn,
  replaceCard,
  requiresFullReload,
  rolesRereadNeeded,
  rolesRevisionOf,
  setMembers,
  upsertById,
  upsertCard,
} from '@/modules/kanban/lib/boardSync';
import type {
  Activity,
  ActivityVerb,
  Board,
  BoardSnapshot,
  Card,
  Column,
  Member,
  RoleListResult,
} from '@/modules/kanban/types';
import { canonicalRank } from '@/modules/kanban/lib/canonicalOrder';
import {
  makeAction,
  makeCard as makeFixtureCard,
  makeColumn as makeFixtureColumn,
  makeLinkSnapshot,
  makeSnapshot as makeFixtureSnapshot,
  MILESTONES,
  NOW as FIX_NOW,
} from '../__fixtures__/snapshot';

const ME = 'me00me00me00me00me00me00';
const OTHER = 'you0you0you0you0you0you0';
const NOW = 1_800_000_000;

function makeBoard(overrides: Partial<Board> = {}): Board {
  return {
    _id: 'board1',
    title: 'Chantier',
    description: '',
    status: 'active',
    color: '#2B4C8C',
    startDate: null,
    endDate: null,
    parentType: null,
    parentId: null,
    visibility: 'private',
    allowExternalMembers: false,
    memberIds: [ME, OTHER],
    labels: [],
    counts: { columns: 2, cards: 3, done: 0 },
    rev: 10,
    creator: ME,
    created: NOW,
    updated: NOW,
    members: [
      { userId: ME, role: 'owner', addedBy: ME, addedAt: NOW },
      { userId: OTHER, role: 'editor', addedBy: ME, addedAt: NOW },
    ],
    ...overrides,
  };
}

function makeColumn(id: string, rank: number, overrides: Partial<Column> = {}): Column {
  return {
    _id: id,
    boardId: 'board1',
    title: id,
    titleKey: null,
    rank,
    color: null,
    wipLimit: null,
    isDoneColumn: false,
    cardCount: 0,
    creator: ME,
    created: NOW,
    updated: NOW,
    ...overrides,
  };
}

function makeCard(id: string, columnId: string, rank: number, overrides: Partial<Card> = {}): Card {
  return {
    _id: id,
    boardId: 'board1',
    columnId,
    rank,
    title: id,
    description: '',
    priority: 'medium',
    assignees: [],
    labelIds: [],
    checklist: [],
    checklistDone: 0,
    checklistTotal: 0,
    status: 'not_started',
    links: [],
    linkCount: 0,
    commentCount: 0,
    dueDate: null,
    completedAt: null,
    creator: ME,
    created: NOW,
    updated: NOW,
    ...overrides,
  };
}

function makeMember(userId: string, role: Member['role'] = 'editor'): Member {
  return { userId, role, origin: 'board', inheritedFrom: null, removable: true, profile: null };
}

function makeSnapshot(): BoardSnapshot {
  return {
    board: makeBoard(),
    columns: [makeColumn('todo', 1000), makeColumn('done', 2000, { isDoneColumn: true })],
    cards: [
      makeCard('c1', 'todo', 1000, { assignees: [OTHER] }),
      makeCard('c2', 'todo', 2000),
      // Coherent avec la colonne de cloture : `completedAt` et `status` vont
      // toujours ensemble, cote serveur comme dans l'instantane.
      makeCard('c3', 'done', 1000, { completedAt: NOW - 100, status: 'complete' }),
    ],
    members: [makeMember(ME, 'owner'), makeMember(OTHER)],
    capabilities: {
      role: 'owner',
      canViewBoard: true,
      canEditCards: true,
      canManageColumns: true,
      canManageMembers: true,
      canEditBoard: true,
      canArchiveBoard: true,
      canDeleteBoard: true,
      canAttachBoard: true,
      canDetachBoard: true,
      canLeaveBoard: false,
      isExplicitOwner: true,
      archived: false,
      canReorderColumns: true,
      canRenameColumns: true,
      canArchiveCards: true,
      canManageMilestones: false,
      canEditCredits: false,
      canManageRoles: false,
      source: 'kanban',
    },
    milestones: [],
  };
}

function makeActivity(
  verb: ActivityVerb,
  overrides: Partial<Activity> = {},
): Activity {
  return {
    _id: `a-${verb}-${String(overrides.rev ?? 11)}`,
    boardId: 'board1',
    cardId: null,
    columnId: null,
    actorId: OTHER,
    verb,
    payload: {},
    rev: 11,
    at: NOW,
    ...overrides,
  };
}

/* -------------------------------------------------------------------------- */

describe('mutations optimistes', () => {
  test('upsertCard ajoute puis remplace, et ne mute jamais la source', () => {
    const snapshot = makeSnapshot();
    const added = upsertCard(snapshot, makeCard('c4', 'todo', 3000));

    expect(added.cards).toHaveLength(4);
    // Purete : le cache TanStack Query doit changer d'identite pour re-rendre.
    expect(snapshot.cards).toHaveLength(3);
    expect(added.cards).not.toBe(snapshot.cards);
  });

  test('les compteurs derives suivent chaque changement', () => {
    const snapshot = makeSnapshot();
    const added = upsertCard(snapshot, makeCard('c4', 'done', 3000));

    expect(added.board.counts).toEqual({ columns: 2, cards: 4, done: 2 });
    expect(added.columns.find((column) => column._id === 'done')?.cardCount).toBe(2);
  });

  test('patchCard ignore les champs `undefined`', () => {
    // Un formulaire n'envoie que ce qui a change : `{...card, ...patch}` avec
    // `dueDate: undefined` effacerait l'echeance sans que personne ne l'ait
    // demande (et le typage ne l'aurait pas signale).
    const snapshot = makeSnapshot();
    const withDue = patchCard(snapshot, 'c1', { dueDate: 1234 }, NOW);
    const renamed = patchCard(withDue, 'c1', { title: 'Nouveau', dueDate: undefined }, NOW);

    const card = renamed.cards.find((entry) => entry._id === 'c1');
    expect(card?.title).toBe('Nouveau');
    expect(card?.dueDate).toBe(1234);
  });

  test('patchCard recalcule les compteurs de checklist', () => {
    const snapshot = patchCard(
      makeSnapshot(),
      'c1',
      {
        checklist: [
          { id: 'k1', label: 'Devis', done: true },
          { id: 'k2', label: 'Commande', done: false },
        ],
      },
      NOW,
    );
    const card = snapshot.cards.find((entry) => entry._id === 'c1');
    expect(card?.checklistTotal).toBe(2);
    expect(card?.checklistDone).toBe(1);
  });

  test('deplacer vers la colonne de cloture pose `completedAt` (RG-30)', () => {
    const moved = moveCardInSnapshot(makeSnapshot(), { cardId: 'c1', columnId: 'done', rank: 1500 }, NOW);
    expect(moved.cards.find((card) => card._id === 'c1')?.completedAt).toBe(NOW);

    const back = moveCardInSnapshot(moved, { cardId: 'c1', columnId: 'todo', rank: 1500 }, NOW);
    expect(back.cards.find((card) => card._id === 'c1')?.completedAt).toBeNull();
  });

  test('une carte deja close qui reste close garde sa date d origine', () => {
    const moved = moveCardInSnapshot(makeSnapshot(), { cardId: 'c3', columnId: 'done', rank: 3000 }, NOW);
    expect(moved.cards.find((card) => card._id === 'c3')?.completedAt).toBe(NOW - 100);
  });

  test('passer une colonne en colonne de cloture clot ses cartes', () => {
    const snapshot = patchColumn(makeSnapshot(), 'todo', { isDoneColumn: true }, NOW);
    expect(snapshot.cards.filter((card) => card.completedAt !== null)).toHaveLength(3);
    expect(snapshot.board.counts.done).toBe(3);
  });

  test('replaceCard substitue la carte provisoire a la reponse du serveur', () => {
    const withTemporary = upsertCard(makeSnapshot(), makeCard('tmp-1', 'todo', 3000));
    const reconciled = replaceCard(withTemporary, 'tmp-1', makeCard('real', 'todo', 3000));

    expect(reconciled.cards.map((card) => card._id)).not.toContain('tmp-1');
    expect(reconciled.cards.map((card) => card._id)).toContain('real');
    expect(reconciled.cards).toHaveLength(4);
  });

  test('supprimer une colonne avec destination y reloge les cartes', () => {
    const snapshot = removeColumn(makeSnapshot(), 'todo', 'done', NOW);
    expect(snapshot.columns).toHaveLength(1);
    expect(snapshot.cards).toHaveLength(3);
    expect(snapshot.cards.every((card) => card.columnId === 'done')).toBe(true);
    // La colonne d'arrivee cloture : les cartes relogees sont closes.
    expect(snapshot.cards.every((card) => card.completedAt !== null)).toBe(true);
  });

  test('retirer un membre le desassigne de ses cartes (RG-12)', () => {
    const snapshot = setMembers(makeSnapshot(), [makeMember(ME, 'owner')]);
    expect(snapshot.board.memberIds).toEqual([ME]);
    expect(snapshot.cards.find((card) => card._id === 'c1')?.assignees).toEqual([]);
    // Aucune carte n'est supprimee.
    expect(snapshot.cards).toHaveLength(3);
  });

  test('la renumerotation du serveur ecrase les rangs locaux', () => {
    const snapshot = applyRankUpdates(makeSnapshot(), 'cards', [
      { id: 'c2', rank: 1000 },
      { id: 'c1', rank: 2000 },
    ]);
    expect(snapshot.cards.filter((card) => card.columnId === 'todo').map((card) => card._id)).toEqual([
      'c2',
      'c1',
    ]);
  });
});

/* -------------------------------------------------------------------------- */

describe('reducteur d activites', () => {
  test('mes propres activites sont rejouees comme les autres (convergence entre onglets)', () => {
    // Filtrer sur l'auteur consommait le `rev` sans appliquer le contenu :
    // deux onglets du meme utilisateur ne convergeaient jamais. L'activite
    // portant l'entite serveur, la rejouer est sans danger.
    const snapshot = makeSnapshot();
    const mine = makeActivity('card.deleted', { actorId: ME, cardId: 'c1', rev: 11 });
    const next = applyActivities(snapshot, [mine], NOW);

    expect(next.cards.map((card) => card._id)).not.toContain('c1');
    // Le compteur de revision avance : sinon le prochain `board/sync`
    // redemanderait indefiniment la meme fenetre.
    expect(next.board.rev).toBe(11);
  });

  test('rejouer DEUX FOIS la meme activite donne exactement le meme etat', () => {
    // L'idempotence est ce qui autorise a ne plus filtrer par auteur : une
    // fenetre de sync qui se recouvre ne doit jamais dupliquer ni deriver.
    const snapshot = makeSnapshot();
    const created = makeCard('c9', 'todo', 5000);
    const activities = [
      makeActivity('card.created', { actorId: ME, cardId: 'c9', payload: { card: created }, rev: 11 }),
      makeActivity('card.moved', {
        actorId: ME,
        cardId: 'c9',
        columnId: 'done',
        payload: { card: { ...created, columnId: 'done', rank: 1500, completedAt: NOW } },
        rev: 12,
      }),
    ];

    const once = applyActivities(snapshot, activities, NOW);
    const twice = applyActivities(once, activities, NOW);

    expect(twice.cards).toEqual(once.cards);
    expect(twice.columns).toEqual(once.columns);
    expect(twice.board).toEqual(once.board);
    expect(twice.board.rev).toBe(12);
  });

  test('un delta realiste (creation, deplacement, suppression) tient les compteurs', () => {
    // Le journal transporte desormais l'entite (contrat §7) : le delta se
    // rejoue integralement, sans aucun `board/get`.
    const snapshot = makeSnapshot();
    const created = makeCard('c4', 'todo', 3000);
    const movedToDone = { ...created, columnId: 'done', rank: 1500, completedAt: NOW };
    const delta = [
      makeActivity('card.created', { cardId: 'c4', payload: { card: created }, rev: 11 }),
      makeActivity('card.moved', {
        cardId: 'c4',
        columnId: 'done',
        payload: { card: movedToDone },
        rev: 12,
      }),
      makeActivity('card.deleted', { cardId: 'c2', rev: 13 }),
    ];

    expect(requiresFullReload(delta)).toBe(false);
    const next = applyActivities(snapshot, delta, NOW);

    expect(next.cards.map((card) => card._id).sort()).toEqual(['c1', 'c3', 'c4']);
    expect(next.cards.find((card) => card._id === 'c4')?.columnId).toBe('done');
    // 3 cartes, dont 2 dans la colonne de cloture.
    expect(next.board.counts).toEqual({ columns: 2, cards: 3, done: 2 });
    expect(next.columns.find((column) => column._id === 'todo')?.cardCount).toBe(1);
    expect(next.columns.find((column) => column._id === 'done')?.cardCount).toBe(2);
    expect(next.board.rev).toBe(13);
  });

  test('column.created / column.moved exigent la colonne serialisee', () => {
    const column = makeColumn('backlog', 500);
    const withColumn = makeActivity('column.created', {
      columnId: 'backlog',
      payload: { column },
      rev: 11,
    });
    const withoutColumn = makeActivity('column.created', { columnId: 'backlog', payload: {}, rev: 11 });

    expect(requiresFullReload([withColumn])).toBe(false);
    expect(applyActivities(makeSnapshot(), [withColumn], NOW).columns.map((entry) => entry._id)).toEqual([
      'backlog',
      'todo',
      'done',
    ]);
    // Sans l'entite, la colonne ne peut pas etre inventee : on recharge.
    expect(requiresFullReload([withoutColumn])).toBe(true);
  });

  test('card.moved d un autre utilisateur est rejoue', () => {
    const activity = makeActivity('card.moved', {
      actorId: OTHER,
      cardId: 'c1',
      columnId: 'done',
      payload: { fromColumnId: 'todo', toColumnId: 'done', rank: 1500 },
      rev: 12,
    });
    const next = applyActivities(makeSnapshot(), [activity], NOW);
    const card = next.cards.find((entry) => entry._id === 'c1');

    expect(card?.columnId).toBe('done');
    expect(card?.rank).toBe(1500);
    expect(card?.completedAt).toBe(NOW);
    expect(next.board.rev).toBe(12);
  });

  test('card.deleted retire la carte et recalcule les compteurs', () => {
    const activity = makeActivity('card.deleted', { cardId: 'c3', rev: 13 });
    const next = applyActivities(makeSnapshot(), [activity], NOW);

    expect(next.cards).toHaveLength(2);
    expect(next.board.counts).toEqual({ columns: 2, cards: 2, done: 0 });
  });

  test('card.created n est rejoue que si le journal porte la carte entiere', () => {
    const created = makeCard('c9', 'todo', 5000);
    const withCard = makeActivity('card.created', { cardId: 'c9', payload: { card: created }, rev: 14 });
    const withoutCard = makeActivity('card.created', { cardId: 'c9', payload: { title: 'Sans corps' }, rev: 14 });

    expect(applyActivities(makeSnapshot(), [withCard], NOW).cards).toHaveLength(4);
    expect(requiresFullReload([withCard])).toBe(false);

    // Sans la carte, elle ne peut pas etre inventee : on recharge.
    expect(applyActivities(makeSnapshot(), [withoutCard], NOW).cards).toHaveLength(3);
    expect(requiresFullReload([withoutCard])).toBe(true);
  });

  test('les activites sont rejouees dans l ordre des revisions', () => {
    // Deplacer puis supprimer n'est pas la meme chose que l'inverse : le
    // journal doit etre rejoue dans l'ordre d'ecriture, pas de reception.
    const move = makeActivity('card.moved', {
      cardId: 'c1',
      payload: { toColumnId: 'done', rank: 1500 },
      rev: 11,
    });
    const remove = makeActivity('card.deleted', { cardId: 'c1', rev: 12 });

    const next = applyActivities(makeSnapshot(), [remove, move], NOW);
    expect(next.cards.map((card) => card._id)).not.toContain('c1');
    expect(next.board.rev).toBe(12);
  });

  test('board.archived bascule le tableau en lecture seule', () => {
    const activity = makeActivity('board.archived', { payload: { archived: true }, rev: 15 });
    expect(applyActivities(makeSnapshot(), [activity], NOW).board.status).toBe('archived');
  });

  test('un delta vide laisse l instantane inchange', () => {
    const snapshot = makeSnapshot();
    expect(applyActivities(snapshot, [], NOW)).toBe(snapshot);
  });
});

describe('requiresFullReload', () => {
  test('les changements de membres imposent un rechargement complet', () => {
    // Le journal ne porte ni le profil ajoute ni les cartes desassignees.
    expect(requiresFullReload([makeActivity('member.added', { payload: { userId: 'x', role: 'editor' } })])).toBe(true);
    expect(requiresFullReload([makeActivity('member.removed')])).toBe(true);
    expect(requiresFullReload([makeActivity('board.updated')])).toBe(true);
  });

  test('column.updated qui a bascule des cartes impose un rechargement', () => {
    const column = makeColumn('todo', 1000, { isDoneColumn: true });
    const withTouched = makeActivity('column.updated', {
      columnId: 'todo',
      payload: { column, touchedCards: ['c1', 'c2'] },
    });
    const withoutTouched = makeActivity('column.updated', {
      columnId: 'todo',
      payload: { column, touchedCards: [] },
    });

    expect(requiresFullReload([withTouched])).toBe(true);
    expect(requiresFullReload([withoutTouched])).toBe(false);
  });

  test('column.deleted qui a reloge des cartes impose un rechargement', () => {
    expect(
      requiresFullReload([makeActivity('column.deleted', { columnId: 'todo', payload: { movedCards: 3 } })]),
    ).toBe(true);
    expect(
      requiresFullReload([makeActivity('column.deleted', { columnId: 'todo', payload: { movedCards: 0 } })]),
    ).toBe(false);
  });

  /*
   * §12, D30 : un role attribue ne change aucune carte. L'activite s'applique
   * comme un NO-OP (la revision avance, rien n'est recharge) et c'est la liste
   * des roles, cache a part, qui se relit (`rolesTouched`).
   */
  test('role.updated n impose PAS de rechargement : no-op sur l instantane, revision avancee', () => {
    const roleActivity = makeActivity('role.updated', {
      rev: 12,
      payload: { member: { id: OTHER, type: 'citoyens', roles: ['Communication'] } },
    });
    expect(requiresFullReload([roleActivity])).toBe(false);
    const snapshot = makeSnapshot();
    const next = applyActivities(snapshot, [roleActivity], NOW);
    expect(next.board.rev).toBe(12);
    expect(next.cards).toBe(snapshot.cards);
    expect(next.members).toBe(snapshot.members);
    expect(decideSync(snapshot.board.rev, { rev: 12, full: false, activities: [roleActivity] })).toEqual({
      kind: 'apply',
      activities: [roleActivity],
    });
  });

  test('rolesTouched : seul role.updated fait relire la liste des roles', () => {
    expect(rolesTouched([makeActivity('role.updated', { payload: { role: 'Accueil', created: true } })])).toBe(true);
    expect(rolesTouched([makeActivity('card.moved'), makeActivity('member.added')])).toBe(false);
    expect(rolesTouched([])).toBe(false);
  });

  test('rolesRevisionOf : la plus haute revision des role.updated du delta, null sans eux', () => {
    const roles = [
      makeActivity('role.updated', { rev: 14, payload: { role: 'Accueil', created: true } }),
      makeActivity('card.moved', { rev: 20 }),
      makeActivity('role.updated', { rev: 16, payload: { member: { id: OTHER, type: 'citoyens', roles: [] } } }),
    ];
    expect(rolesRevisionOf(roles)).toBe(16);
    expect(rolesRevisionOf([makeActivity('card.moved', { rev: 20 })])).toBeNull();
    expect(rolesRevisionOf([])).toBeNull();
  });

  /*
   * Le polling rapporte aussi MES ecritures de roles (il ne regarde pas
   * l'auteur) : la liste, qui porte la revision de sa derniere reponse, ne se
   * relit que si le delta va PLUS LOIN qu'elle. Sans liste en cache, on relit.
   */
  test('rolesRereadNeeded : relire seulement au-dela de la revision connue de la liste', () => {
    const own = [makeActivity('role.updated', { rev: 14, payload: { role: 'Accueil', created: true } })];
    const theirs = [...own, makeActivity('role.updated', { rev: 15, payload: { member: { id: OTHER, type: 'citoyens', roles: ['Accueil'] } } })];
    // Ma propre ecriture (rev 14) deja posee sur la liste : rien a relire.
    expect(rolesRereadNeeded(own, 14)).toBe(false);
    expect(rolesRereadNeeded(own, 20)).toBe(false);
    // Une ecriture d'un autre client, plus recente que la liste : relire.
    expect(rolesRereadNeeded(theirs, 14)).toBe(true);
    // Liste absente du cache (vue fermee) : relire comme avant.
    expect(rolesRereadNeeded(own, undefined)).toBe(true);
    // Aucune activite de role : jamais.
    expect(rolesRereadNeeded([makeActivity('card.moved', { rev: 30 })], undefined)).toBe(false);
    expect(rolesRereadNeeded([], 0)).toBe(false);
  });

  test('l auteur d une activite n entre PLUS dans la decision', () => {
    // Un `member.added` declenche par MOI change autant mon second onglet que
    // celui d'un collegue : le tri se fait sur le contenu, jamais sur l'auteur.
    const mine = makeActivity('member.added', { actorId: ME });
    const theirs = makeActivity('member.added', { actorId: OTHER });
    expect(requiresFullReload([mine])).toBe(true);
    expect(requiresFullReload([theirs])).toBe(true);
  });
});

/* -------------------------------------------------------------------------- */

describe('decideRollback', () => {
  test('restaure quand le cache porte encore l instantane ecrit par onMutate', () => {
    const previous = makeSnapshot();
    const optimistic = removeCard(previous, 'c1');
    expect(decideRollback(optimistic, { previous, optimistic })).toBe('restore');
  });

  test('invalide des qu une autre ecriture est passee entre-temps', () => {
    // Le scenario du constat : une carte provisoire remplacee par sa vraie
    // carte, ou une renumerotation serveur. Reposer `previous` la perdrait.
    const previous = makeSnapshot();
    const optimistic = upsertCard(previous, makeCard('tmp-1', 'todo', 3000));
    const confirmed = replaceCard(optimistic, 'tmp-1', makeCard('c4', 'todo', 3000));
    expect(decideRollback(confirmed, { previous, optimistic })).toBe('invalidate');
  });

  test('ne fait rien sans ecriture optimiste (ajout de membre)', () => {
    const previous = makeSnapshot();
    expect(decideRollback(previous, { previous })).toBe('none');
    expect(decideRollback(previous, undefined)).toBe('none');
  });

  test('generique : la meme regle pour la liste des roles (§12), par identite de reference', () => {
    const previous: RoleListResult = { roles: [], members: [], canManageRoles: true, rev: 4 };
    const optimistic: RoleListResult = { ...previous, roles: [{ name: 'Accueil', declared: true, memberIds: [] }] };
    expect(decideRollback<RoleListResult>(optimistic, { previous, optimistic })).toBe('restore');
    // Une copie EGALE n'est pas la reference ecrite : quelqu'un d'autre a ecrit.
    expect(decideRollback<RoleListResult>({ ...optimistic }, { previous, optimistic })).toBe('invalidate');
    expect(decideRollback<RoleListResult>(optimistic, { previous })).toBe('none');
  });
});

describe('statut et colonne de cloture', () => {
  test('miroir exact de `KanbanCard::statusForColumn()`', () => {
    expect(statusForColumn('not_started', true)).toBe('complete');
    expect(statusForColumn('complete', false)).toBe('on_track');
    // Une carte « en recherche » qui passe d'une colonne ordinaire a une autre
    // ne doit PAS voir son statut reecrit au passage.
    expect(statusForColumn('in_research', false)).toBe('in_research');
    expect(statusForColumn('complete', true)).toBe('complete');
  });

  test('deplacer vers la colonne de cloture pose aussi le statut', () => {
    // Sans cela, la pastille haute afficherait « Non demarre » sur une carte
    // qu'on vient de deposer dans « Termine », jusqu'a la reponse du serveur.
    const snapshot = moveCardInSnapshot(
      makeSnapshot(),
      { cardId: 'c1', columnId: 'done', rank: 500 },
      NOW,
    );
    expect(snapshot.cards.find((card) => card._id === 'c1')?.status).toBe('complete');
  });

  test('debasculer une colonne « terminee » rouvre ses cartes', () => {
    const closed = patchColumn(makeSnapshot(), 'done', { isDoneColumn: false }, NOW);
    const card = closed.cards.find((entry) => entry._id === 'c3');
    expect(card?.completedAt).toBeNull();
    expect(card?.status).toBe('on_track');
  });
});

describe('compteurs derives de la carte', () => {
  test('`patchCard` recalcule `linkCount` avec les liens', () => {
    const snapshot = patchCard(
      makeSnapshot(),
      'c1',
      { links: [{ id: 'lk_1', url: 'https://exemple.org', label: 'exemple.org' }] },
      NOW,
    );
    expect(snapshot.cards.find((card) => card._id === 'c1')?.linkCount).toBe(1);
  });

  test('le compteur de commentaires ne touche pas `updated`', () => {
    // Commenter ne modifie pas la carte : la faire remonter dans un tri
    // « recemment modifiees » pour un simple message serait faux.
    const snapshot = setCardCommentCount(makeSnapshot(), 'c1', 4);
    const card = snapshot.cards.find((entry) => entry._id === 'c1');
    expect(card?.commentCount).toBe(4);
    expect(card?.updated).toBe(NOW);
  });

  test('le compteur ne descend jamais sous zero', () => {
    const snapshot = adjustCardCommentCount(makeSnapshot(), 'c1', -3);
    expect(snapshot.cards.find((card) => card._id === 'c1')?.commentCount).toBe(0);
  });

  test('une carte absente laisse l instantane INCHANGE, meme reference', () => {
    // C'est ce qui permet de balayer tous les instantanes en cache sans
    // provoquer de rendu sur ceux qui ne portent pas la carte.
    const snapshot = makeSnapshot();
    expect(adjustCardCommentCount(snapshot, 'inconnue', 1)).toBe(snapshot);
    expect(setCardCommentCount(snapshot, 'c1', snapshot.cards[0].commentCount)).toBe(snapshot);
  });
});

/* -------------------------------------------------------------------------- */
/*  Board-lien Communecter (§11)                                              */
/* -------------------------------------------------------------------------- */

describe('board-lien : algebre propre a la source communecter', () => {
  test('commit range les cartes au rang CANONIQUE (priorite, puis plus recente)', () => {
    const snapshot = makeLinkSnapshot({
      cards: [
        makeAction('66aa00010000000000000001', 'todo', { priority: null, created: FIX_NOW - 100 }),
        makeAction('66aa00020000000000000002', 'todo', { priority: 'urgent', created: FIX_NOW - 500 }),
        makeAction('66aa00030000000000000003', 'todo', { priority: null, created: FIX_NOW - 50 }),
      ],
    });
    // Une ecriture quelconque passe par `commit` : l'ordre devient canonique.
    const next = upsertCard(snapshot, snapshot.cards[0]);
    expect(next.cards.map((card) => card._id.slice(-1))).toEqual(['2', '3', '1']);
    expect(next.cards[0].rank).toBe(canonicalRank(next.cards[0]));
  });

  test('changer la priorite fait remonter la carte, comme le serveur le fera', () => {
    const snapshot = makeLinkSnapshot({
      cards: [
        makeAction('66aa00010000000000000001', 'todo', { created: FIX_NOW - 100 }),
        makeAction('66aa00020000000000000002', 'todo', { created: FIX_NOW - 10 }),
      ],
    });
    const next = patchCard(snapshot, '66aa00010000000000000001', { priority: 'high' }, FIX_NOW);
    expect(next.cards[0]._id).toBe('66aa00010000000000000001');
  });

  test('deplacer : le statut DECOULE de la colonne, la cloture suit « done »', () => {
    const snapshot = makeLinkSnapshot({ cards: [makeAction('a1', 'todo')] });
    const tracking = moveCardInSnapshot(snapshot, { cardId: 'a1', columnId: 'tracking', rank: 0 }, FIX_NOW);
    expect(tracking.cards[0]).toMatchObject({ columnId: 'tracking', status: 'on_track', completedAt: null });
    const done = moveCardInSnapshot(tracking, { cardId: 'a1', columnId: 'done', rank: 0 }, FIX_NOW);
    expect(done.cards[0]).toMatchObject({ status: 'complete', completedAt: FIX_NOW });
    const back = moveCardInSnapshot(done, { cardId: 'a1', columnId: 'totest', rank: 0 }, FIX_NOW);
    // Pas de `on_track` impose a la sortie de « done » (regle kanban) : la colonne decide.
    expect(back.cards[0]).toMatchObject({ status: 'not_started', completedAt: null });
    expect(back.board.counts.done).toBe(0);
  });

  test('cardPatchFromUpdate traduit tags -> labelIds et milestoneId -> copie du jalon', () => {
    const snapshot = makeLinkSnapshot({ cards: [makeAction('a1', 'todo')] });
    expect(cardPatchFromUpdate(snapshot, { tags: ['web', 'UX'], milestoneId: MILESTONES[1].milestoneId })).toEqual({
      tags: ['web', 'UX'],
      labelIds: ['tag:web', 'tag:UX'],
      milestone: { milestoneId: MILESTONES[1].milestoneId, name: 'V1.2', status: 'open' },
    });
    expect(cardPatchFromUpdate(snapshot, { milestoneId: null, priority: null })).toEqual({ milestone: null, priority: null });
    // Jalon inconnu : rien d'invente, le serveur tranchera.
    expect(cardPatchFromUpdate(snapshot, { milestoneId: 'inconnu' })).toEqual({});
  });

  test('un tag tout juste saisi recoit son etiquette sans attendre board/get', () => {
    const snapshot = makeLinkSnapshot({ cards: [makeAction('a1', 'todo')] });
    const next = patchCard(snapshot, 'a1', cardPatchFromUpdate(snapshot, { tags: ['Agenda'] }), FIX_NOW);
    expect(next.board.labels).toEqual([{ id: 'tag:Agenda', name: 'Agenda', color: '#dc2626' }]);
  });

  test('board kanban : ni rang canonique ni etiquettes derivees', () => {
    const snapshot = makeFixtureSnapshot({
      columns: [makeFixtureColumn('todo', 1000)],
      cards: [makeFixtureCard('c1', 'todo', { rank: 5000, tags: ['web'] })],
    });
    const next = upsertCard(snapshot, snapshot.cards[0]);
    expect(next.cards[0].rank).toBe(5000);
    expect(next.board.labels).toBe(snapshot.board.labels);
  });

  test('markCardCommentsSeen remet a zero, et garde l identite sans non-lus', () => {
    const snapshot = makeLinkSnapshot({ cards: [makeAction('a1', 'todo', { unseenComments: 2 }), makeAction('a2', 'todo')] });
    expect(markCardCommentsSeen(snapshot, 'a1').cards.find((card) => card._id === 'a1')?.unseenComments).toBe(0);
    expect(markCardCommentsSeen(snapshot, 'a2')).toBe(snapshot);
    expect(markCardCommentsSeen(snapshot, 'inconnue')).toBe(snapshot);
  });

  test('jalons : liste remplacee, jalon pose a sa place ou ajoute', () => {
    const snapshot = makeLinkSnapshot();
    const renamed = upsertMilestone(snapshot, { ...MILESTONES[1], name: 'V1.2 bis' });
    expect(renamed.milestones.map((milestone) => milestone.name)).toEqual(['V1.1', 'V1.2 bis']);
    const added = upsertMilestone(snapshot, { ...MILESTONES[1], milestoneId: 'zZ', name: 'V2' });
    expect(added.milestones).toHaveLength(3);
    expect(setMilestones(snapshot, []).milestones).toEqual([]);
  });
});

describe('buildOptimisticCard', () => {
  const context = { temporaryId: 'tmp-1', userId: ME, now: FIX_NOW };

  test('board kanban : priorite moyenne, statut complete dans la colonne de cloture', () => {
    const snapshot = makeSnapshot();
    expect(buildOptimisticCard(snapshot, { columnId: 'todo', title: 'A' }, context)).toMatchObject({
      priority: 'medium',
      status: 'not_started',
      completedAt: null,
      boardId: 'board1',
    });
    expect(buildOptimisticCard(snapshot, { columnId: 'done', title: 'B' }, context)).toMatchObject({
      status: 'complete',
      completedAt: FIX_NOW,
    });
  });

  test('board-lien : sans priorite, statut de la colonne, montant 1, tags et jalon traduits', () => {
    const snapshot = makeLinkSnapshot();
    const card = buildOptimisticCard(
      snapshot,
      { columnId: 'tracking', title: 'C', tags: ['web'], milestoneId: MILESTONES[1].milestoneId, links: [] },
      context,
    );
    expect(card).toMatchObject({
      priority: null,
      status: 'on_track',
      tags: ['web'],
      labelIds: ['tag:web'],
      milestone: { milestoneId: MILESTONES[1].milestoneId, name: 'V1.2', status: 'open' },
      credits: 1,
      timeSpent: 0,
      links: [],
      linkCount: 0,
    });
  });

  test('aucune colonne : rien a poser', () => {
    expect(buildOptimisticCard({ ...makeSnapshot(), columns: [] }, { title: 'D' }, context)).toBeNull();
  });
});

describe('activites des boards-liens', () => {
  test('card.deleted avec `archived` retire la carte, comme une suppression', () => {
    const next = applyActivities(makeSnapshot(), [
      makeActivity('card.deleted', { cardId: 'c1', rev: 11, payload: { archived: true, title: 'c1' } }),
    ]);
    expect(next.cards.some((card) => card._id === 'c1')).toBe(false);
    expect(requiresFullReload([makeActivity('card.deleted', { cardId: 'c1', payload: { archived: true } })])).toBe(false);
  });

  test('board kanban : un column.moved qui a renumerote d AUTRES colonnes fait recharger', () => {
    // Le journal n'en porte que le NOMBRE (PHP et backend factice) : les
    // nouveaux rangs ne sont nulle part, seul `board/get` les donne.
    const snapshot = makeSnapshot();
    const moved = { ...snapshot.columns[1], rank: 500 };
    const activity = makeActivity('column.moved', { columnId: 'done', rev: 11, payload: { column: moved, rank: 500, renumbered: 3 } });
    expect(requiresFullReload([activity])).toBe(true);
    expect(decideSync(10, { rev: 11, full: false, activities: [activity] })).toEqual({ kind: 'reload' });
    // Sans renumerotation, le deplacement se rejoue tel quel.
    const alone = makeActivity('column.moved', { columnId: 'done', rev: 11, payload: { column: moved, rank: 500, renumbered: 0 } });
    expect(requiresFullReload([alone])).toBe(false);
    expect(applyActivities(snapshot, [alone]).columns[0]._id).toBe('done');
  });

  test('board-lien : une colonne virtuelle rejouee ne prend que son RANG, pas le libelle de l auteur', () => {
    // Libelle personnalise en francais seulement (cas reel de 3 organisations) :
    // l'auteur du deplacement, en anglais, recoit le libelle par defaut.
    const columns = makeLinkSnapshot().columns.map((column) =>
      column._id === 'discuter' ? { ...column, title: 'Nouvelle demande', titleKey: null, virtual: true } : { ...column, virtual: true },
    );
    const snapshot = makeLinkSnapshot({ columns });
    const discuss = columns.find((column) => column._id === 'discuter');
    if (!discuss) throw new Error('colonne « discuter » absente des colonnes virtuelles');
    const fromEnglishAuthor = { ...discuss, title: 'To discuss', titleKey: 'discuter', rank: 500 };
    const activity = makeActivity('column.moved', {
      columnId: 'discuter',
      rev: 13,
      payload: { column: fromEnglishAuthor, rank: 500, renumbered: 4 },
    });
    // Une activite par colonne renumerotee (§11.9 E8) : rien a recharger.
    expect(requiresFullReload([activity])).toBe(false);
    const next = applyActivities(snapshot, [activity], FIX_NOW, ME);
    expect(next.columns[0]).toMatchObject({ _id: 'discuter', rank: 500, title: 'Nouvelle demande', titleKey: null });
  });
});

describe('non-lus d une action rejouee depuis le journal (§11.9)', () => {
  /*
   * `payload.card` est partage entre lecteurs : le serveur n'y met jamais
   * `unseenComments`. Le rejeu doit garder la pastille du lecteur, sinon un
   * simple deplacement fait par un collegue l'effacerait.
   */
  const LINK_CARD = 'c0c0c0c0c0c0c0c0c0c0c0c0';
  function linkSnapshot(unseen: number, commentCount: number): BoardSnapshot {
    return makeLinkSnapshot({ cards: [makeAction(LINK_CARD, 'todo', { unseenComments: unseen, commentCount })] });
  }
  /** Carte telle que le JOURNAL la transporte : sans `unseenComments`. */
  function journalCard(overrides: Partial<Card>): Card {
    const { unseenComments: _unseen, ...card } = makeAction(LINK_CARD, 'todo', overrides);
    return card;
  }

  test('card.moved par un collegue : la carte suit, ses non-lus restent', () => {
    const next = applyActivities(linkSnapshot(2, 3), [
      makeActivity('card.moved', {
        cardId: LINK_CARD,
        rev: 13,
        payload: { card: journalCard({ columnId: 'tracking', status: 'on_track', commentCount: 3 }), toColumnId: 'tracking' },
      }),
    ], FIX_NOW, ME);
    expect(next.cards[0]).toMatchObject({ columnId: 'tracking', unseenComments: 2 });
  });

  test('commentaire d une AUTRE personne : un non-lu de plus', () => {
    const next = applyActivities(linkSnapshot(1, 1), [
      makeActivity('card.updated', {
        cardId: LINK_CARD,
        rev: 13,
        payload: { card: journalCard({ commentCount: 2 }), fields: ['commentCount'], comment: { authorId: OTHER } },
      }),
    ], FIX_NOW, ME);
    expect(next.cards[0]).toMatchObject({ commentCount: 2, unseenComments: 2 });
  });

  test('rejouer la MEME ligne ne compte pas deux fois le non-lu (rejeu idempotent)', () => {
    // Depart a 0 non-lu sur 1 message : le plafond `commentCount` ne peut pas
    // masquer un double comptage, seule la garde de revision le peut.
    const activity = makeActivity('card.updated', {
      cardId: LINK_CARD,
      rev: 13,
      payload: { card: journalCard({ commentCount: 2 }), fields: ['commentCount'], comment: { authorId: OTHER } },
    });
    const once = applyActivities(linkSnapshot(0, 1), [activity], FIX_NOW, ME);
    expect(once.cards[0].unseenComments).toBe(1);
    const twice = applyActivities(once, [activity], FIX_NOW, ME);
    expect(twice.cards[0]).toEqual(once.cards[0]);
  });

  test('activite deja comptee par un board/get plus recent : pas de second non-lu', () => {
    // Course reelle : `board/get` (rev 13, non-lus calcules par le serveur)
    // atterrit pendant qu'un `board/sync` parti avant rapporte la ligne 13.
    const reloaded = makeLinkSnapshot({
      board: { ...makeLinkSnapshot().board, rev: 13 },
      cards: [makeAction(LINK_CARD, 'todo', { unseenComments: 1, commentCount: 2 })],
    });
    const activity = makeActivity('card.updated', {
      cardId: LINK_CARD,
      rev: 13,
      payload: { card: journalCard({ commentCount: 2 }), fields: ['commentCount'], comment: { authorId: OTHER } },
    });
    expect(applyActivities(reloaded, [activity], FIX_NOW, ME).cards[0].unseenComments).toBe(1);
  });

  test('mon +1 optimiste ne masque pas le commentaire d un collegue arrive avant le mien', () => {
    // Je poste (+1 local) pendant que le commentaire de B est encore dans le
    // journal : sa ligne arrive avec un `commentCount` que j'ai deja atteint.
    const optimistic = adjustCardCommentCount(linkSnapshot(0, 1), LINK_CARD, 1);
    const fromColleague = makeActivity('card.updated', {
      cardId: LINK_CARD,
      rev: 13,
      payload: { card: journalCard({ commentCount: 2 }), fields: ['commentCount'], comment: { authorId: OTHER } },
    });
    expect(applyActivities(optimistic, [fromColleague], FIX_NOW, ME).cards[0].unseenComments).toBe(1);
  });

  test('carte nee chez un collegue (card.created) : ses commentaires suivants deviennent non lus', () => {
    const created = journalCard({ _id: 'born0born0born0born0born', commentCount: 0 });
    const next = applyActivities(makeLinkSnapshot({ cards: [] }), [
      makeActivity('card.created', { cardId: created._id, rev: 13, payload: { card: created } }),
      makeActivity('card.updated', {
        cardId: created._id,
        rev: 14,
        payload: { card: { ...created, commentCount: 1 }, fields: ['commentCount'], comment: { authorId: OTHER } },
      }),
    ], FIX_NOW, ME);
    expect(next.cards[0]).toMatchObject({ commentCount: 1, unseenComments: 1 });
  });

  test('son PROPRE commentaire (autre onglet) : vu d office, pas de non-lu', () => {
    const next = applyActivities(linkSnapshot(0, 0), [
      makeActivity('card.updated', {
        actorId: ME,
        cardId: LINK_CARD,
        rev: 13,
        payload: { card: journalCard({ commentCount: 1 }), fields: ['commentCount'], comment: { authorId: ME } },
      }),
    ], FIX_NOW, ME);
    expect(next.cards[0].unseenComments).toBe(0);
  });

  test('fil raccourci : jamais plus de non-lus que de messages', () => {
    const next = applyActivities(linkSnapshot(3, 3), [
      makeActivity('card.updated', {
        cardId: LINK_CARD,
        rev: 13,
        payload: { card: journalCard({ commentCount: 1 }), fields: ['commentCount'], commentDeleted: true },
      }),
    ], FIX_NOW, ME);
    expect(next.cards[0].unseenComments).toBe(1);
  });

  test('une carte kanban (sans compteur local) reste sans compteur', () => {
    const snapshot = makeSnapshot();
    const card = snapshot.cards[0];
    const next = applyActivities(snapshot, [
      makeActivity('card.updated', { cardId: card._id, rev: 13, payload: { card: { ...card, title: 'Renommee' } } }),
    ], NOW, ME);
    expect(next.cards.find((entry) => entry._id === card._id)).not.toHaveProperty('unseenComments');
  });
});

describe('decideSync', () => {
  test('full -> recharger', () => {
    expect(decideSync(10, { rev: 12, full: true })).toEqual({ kind: 'reload' });
  });

  test('delta rejouable -> appliquer', () => {
    const activities = [makeActivity('card.deleted', { cardId: 'c1', rev: 11 })];
    expect(decideSync(10, { rev: 11, full: false, activities })).toEqual({ kind: 'apply', activities });
  });

  test('activite non rejouable (board.updated : jalons, ecriture externe) -> recharger', () => {
    const activities = [makeActivity('board.updated', { rev: 11 })];
    expect(decideSync(10, { rev: 11, full: false, activities })).toEqual({ kind: 'reload' });
  });

  test('revision serveur au-dela du journal rendu (ecriture non journalisee, D17) -> recharger', () => {
    const activities = [makeActivity('card.deleted', { cardId: 'c1', rev: 11 })];
    expect(decideSync(10, { rev: 13, full: false, activities })).toEqual({ kind: 'reload' });
  });

  test('revision avancee SANS activite (ligne de journal pas encore inseree) -> recharger ; a jour -> rien', () => {
    // Le PHP incremente `rev` puis insere la ligne : suivre le compteur
    // sauterait cette revision pour de bon.
    expect(decideSync(10, { rev: 12, full: false, activities: [] })).toEqual({ kind: 'reload' });
    expect(decideSync(10, { rev: 10, full: false, activities: [] })).toEqual({ kind: 'none' });
  });
});

describe('fils de commentaires touches par un delta', () => {
  test('commentaire ajoute ou supprime : la carte est listee une fois ; le reste non', () => {
    const activities = [
      makeActivity('card.updated', { cardId: 'c1', rev: 11, payload: { comment: { authorId: OTHER } } }),
      makeActivity('card.updated', { cardId: 'c1', rev: 12, payload: { commentId: 'x', commentDeleted: true } }),
      makeActivity('card.updated', { cardId: 'c2', rev: 13, payload: { fields: ['title'] } }),
      makeActivity('card.moved', { cardId: 'c3', rev: 14, payload: { comment: { authorId: OTHER } } }),
    ];
    expect(commentThreadsTouched(activities)).toEqual(['c1']);
  });
});

describe('fusion des listes dans l optimiste de card/update (board-lien)', () => {
  test('les listes envoyees avec leur base sont FUSIONNEES avec la carte du cache', () => {
    // Le polling a apporte S2 (ajoutee dans gestion) et un assigne depuis
    // l'ouverture de la modale, qui ne les a jamais vus.
    const current = makeAction('a1', 'todo', {
      checklist: [
        { id: 't1', label: 'S1', done: false },
        { id: 't2', label: 'S2', done: false },
      ],
      assignees: ['u1', 'u2'],
      tags: ['Web', 'urgent'],
    });
    const snapshot = makeLinkSnapshot({ cards: [current] });
    const patch = cardPatchFromUpdate(
      snapshot,
      {
        checklist: [{ id: 't1', label: 'S1', done: true }],
        checklistBase: [{ id: 't1', label: 'S1', done: false }],
        assignees: ['u1', 'u3'],
        assigneesBase: ['u1'],
        tags: ['mobile'],
        tagsBase: ['web'],
      },
      current,
    );
    expect(patch.checklist).toEqual([
      { id: 't1', label: 'S1', done: true },
      { id: 't2', label: 'S2', done: false },
    ]);
    expect(patch.assignees).toEqual(['u1', 'u2', 'u3']);
    expect(patch.tags).toEqual(['urgent', 'mobile']);
    expect(patch.labelIds).toEqual(['tag:urgent', 'tag:mobile']);
    // Les bases ne sont pas des champs de carte.
    expect(patch).not.toHaveProperty('checklistBase');
    expect(patch).not.toHaveProperty('assigneesBase');
    expect(patch).not.toHaveProperty('tagsBase');
  });

  test('un point ajoute garde l identifiant du client tant qu il est libre', () => {
    const current = makeAction('a1', 'todo', { checklist: [{ id: 'ck_2', label: 'Ailleurs', done: false }] });
    const patch = cardPatchFromUpdate(
      makeLinkSnapshot({ cards: [current] }),
      { checklist: [{ id: 'ck_2', label: 'Moi', done: false }], checklistBase: [] },
      current,
    );
    // `ck_2` est deja pris par un point concurrent : suffixe, jamais de doublon.
    expect(patch.checklist?.map((item) => item.id)).toEqual(['ck_2', 'ck_2-2']);
  });
});

describe('carte TRONQUEE par le budget de board/get (checklistTruncated, §11.9 E29)', () => {
  // 12 points dont 3 faits, mais la liste n'est pas servie : budget epuise.
  const truncated = makeAction('a1', 'todo', { checklist: [], checklistDone: 3, checklistTotal: 12, checklistTruncated: true });
  const base = [
    { id: 't1', label: 'S1', done: true },
    { id: 't2', label: 'S2', done: false },
  ];

  test('aucun optimiste de checklist : ni fusion contre la liste vide, ni compteurs recalcules', () => {
    const snapshot = makeLinkSnapshot({ cards: [truncated] });
    const fields = {
      title: 'Renommee',
      checklist: [base[0], { ...base[1], done: true }],
      checklistBase: base,
    };
    const patch = cardPatchFromUpdate(snapshot, fields, truncated);
    // Les AUTRES champs restent optimistes ; la checklist attend le serveur.
    expect(patch).toEqual({ title: 'Renommee' });
    const next = patchCard(snapshot, 'a1', patch, FIX_NOW).cards[0];
    expect(next).toMatchObject({ title: 'Renommee', checklist: [], checklistDone: 3, checklistTotal: 12, checklistTruncated: true });
  });

  test('la reponse du serveur (carte complete, sans drapeau) remplace la carte tronquee', () => {
    const complete = makeAction('a1', 'todo', { checklist: base, checklistDone: 1, checklistTotal: 2 });
    const next = upsertCard(makeLinkSnapshot({ cards: [truncated] }), complete).cards[0];
    expect(next.checklist).toEqual(base);
    expect(next.checklistTruncated).toBeUndefined();
  });

  test('une carte du journal tronquee est rejouee telle quelle : liste vide, drapeau et compteurs exacts', () => {
    const local = makeAction('a1', 'todo', { checklist: base, checklistDone: 1, checklistTotal: 2, unseenComments: 0 });
    const { unseenComments: _unseen, ...journal } = { ...truncated, title: 'Ailleurs' };
    const activity = makeActivity('card.updated', { cardId: 'a1', rev: 13, payload: { card: journal, fields: ['checklist'] } });
    expect(requiresFullReload([activity])).toBe(false);
    const next = applyActivities(makeLinkSnapshot({ cards: [local] }), [activity], FIX_NOW, ME).cards[0];
    // La liste locale n'est plus celle du serveur : la fiche relira la carte.
    expect(next).toMatchObject({ title: 'Ailleurs', checklist: [], checklistDone: 3, checklistTotal: 12, checklistTruncated: true });
  });
});

describe('utilitaires', () => {
  test('upsertById remplace a sa place ou ajoute a la fin', () => {
    const items = [{ k: 'a', v: 1 }, { k: 'b', v: 2 }];
    const keyOf = (item: { k: string }) => item.k;
    expect(upsertById(items, { k: 'b', v: 3 }, keyOf)).toEqual([{ k: 'a', v: 1 }, { k: 'b', v: 3 }]);
    expect(upsertById(items, { k: 'c', v: 4 }, keyOf)).toHaveLength(3);
  });

  test('une ecriture locale conserve la langue des libelles recus', () => {
    const snapshot = { ...makeLinkSnapshot({ cards: [makeAction('a1', 'todo')] }), servedLanguage: 'en' as const };
    expect(patchCard(snapshot, 'a1', { title: 'x' }, FIX_NOW).servedLanguage).toBe('en');
  });
});
