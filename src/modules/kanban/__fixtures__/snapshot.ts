/**
 * Fabriques d'instantanes pour les tests de logique pure.
 *
 * Partagees par `boardStats` et `boardFilter` : deux jeux de fixtures
 * divergeraient, et l'un des deux finirait par tester un contrat que le front
 * n'applique plus. Tout y est explicite — aucun champ n'est laisse a un defaut
 * implicite, puisque c'est precisement l'absence de champ que les gardes de
 * type refusent en production.
 */
import type {
  Board,
  BoardSnapshot,
  Capabilities,
  Card,
  Column,
  Member,
  Milestone,
  Role,
} from '@/modules/kanban/types';

/** Reference temporelle FIGEE : un test d'echeance ne doit pas dependre du jour. */
export const NOW = 1_800_000_000;
export const DAY = 86_400;

export function makeBoard(overrides: Partial<Board> = {}): Board {
  return {
    _id: 'board1',
    title: 'Chantier cantine',
    description: '',
    status: 'active',
    color: null,
    startDate: null,
    endDate: null,
    parentType: null,
    parentId: null,
    visibility: 'private',
    allowExternalMembers: false,
    memberIds: ['u1', 'u2'],
    labels: [
      { id: 'lbl_logistique', name: 'Logistique', color: '#9A6B12' },
      { id: 'lbl_budget', name: 'Budget', color: '#1D4ED8' },
    ],
    counts: { columns: 0, cards: 0, done: 0 },
    rev: 12,
    creator: 'u1',
    created: NOW,
    updated: NOW,
    members: [
      { userId: 'u1', role: 'owner', addedBy: 'u1', addedAt: NOW },
      { userId: 'u2', role: 'editor', addedBy: 'u1', addedAt: NOW },
    ],
    ...overrides,
  };
}

export function makeColumn(id: string, rank: number, overrides: Partial<Column> = {}): Column {
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
    creator: 'u1',
    created: NOW,
    updated: NOW,
    ...overrides,
  };
}

export function makeCard(id: string, columnId: string, overrides: Partial<Card> = {}): Card {
  return {
    _id: id,
    boardId: 'board1',
    columnId,
    rank: 1000,
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
    creator: 'u1',
    created: NOW,
    updated: NOW,
    ...overrides,
  };
}

export function makeMember(userId: string, role: Role, name: string): Member {
  return {
    userId,
    role,
    origin: 'board',
    inheritedFrom: null,
    removable: role !== 'owner',
    profile: {
      _id: userId,
      name,
      username: userId,
      slug: userId,
      profilThumbImageUrl: null,
    },
  };
}

export const CAPABILITIES: Capabilities = {
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
};

export function makeSnapshot(overrides: Partial<BoardSnapshot> = {}): BoardSnapshot {
  return {
    board: makeBoard(),
    columns: [],
    cards: [],
    members: [makeMember('u1', 'owner', 'Alice'), makeMember('u2', 'editor', 'Bob')],
    capabilities: CAPABILITIES,
    milestones: [],
    ...overrides,
  };
}

/* -------------------------------------------------------------------------- */
/*  Board-lien Communecter (§11)                                              */
/* -------------------------------------------------------------------------- */

/** Capacites d'un owner de board-lien (table §11.5). */
export const LINK_CAPABILITIES: Capabilities = {
  role: 'owner',
  canViewBoard: true,
  canEditCards: true,
  canManageColumns: false,
  canManageMembers: false,
  canEditBoard: false,
  canArchiveBoard: true,
  canDeleteBoard: true,
  canAttachBoard: false,
  canDetachBoard: false,
  canLeaveBoard: false,
  isExplicitOwner: false,
  archived: false,
  canReorderColumns: true,
  canRenameColumns: false,
  canArchiveCards: true,
  canManageMilestones: true,
  canEditCredits: true,
  canManageRoles: true,
  source: 'communecter',
};

/** Les six colonnes virtuelles, dans l'ordre par defaut de gestion. */
export function makeLinkColumns(): Column[] {
  return ['todo', 'next', 'tracking', 'totest', 'discuter', 'done'].map((id, index) =>
    makeColumn(id, (index + 1) * 1000, { titleKey: id, isDoneColumn: id === 'done', creator: '' }),
  );
}

export const MILESTONES: Milestone[] = [
  { milestoneId: 'aB3dE5fG7hJ9kL2mN', name: 'V1.1', description: '', startDate: null, endDate: NOW - 10 * DAY, status: 'close' },
  { milestoneId: 'pQ4rS6tU8vW2xY3zA', name: 'V1.2', description: '', startDate: NOW, endDate: NOW + 20 * DAY, status: 'open' },
];

/** Action Communecter vue comme une carte : sans priorite par defaut, champs du §11.4. */
export function makeAction(id: string, columnId: string, overrides: Partial<Card> = {}): Card {
  return makeCard(id, columnId, {
    priority: null,
    tags: [],
    startDate: null,
    milestone: null,
    credits: 1,
    timeSpent: 0,
    unseenComments: 0,
    archived: false,
    status: columnId === 'done' ? 'complete' : columnId === 'tracking' ? 'on_track' : 'not_started',
    completedAt: columnId === 'done' ? NOW - DAY : null,
    ...overrides,
  });
}

export function makeLinkSnapshot(overrides: Partial<BoardSnapshot> = {}): BoardSnapshot {
  return makeSnapshot({
    board: makeBoard({
      source: 'communecter',
      parentType: 'projects',
      parentId: 'project1',
      visibility: 'parentCommunity',
      members: [],
      labels: [],
    }),
    columns: makeLinkColumns(),
    capabilities: LINK_CAPABILITIES,
    milestones: MILESTONES,
    ...overrides,
  });
}
