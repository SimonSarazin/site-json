/**
 * Les deux sources d'un tableau (`src/lib/boardSource.ts`, §11).
 *
 * Le contrat garde ici : derriere `getBoard`, les capacites sont COMPLETES quel
 * que soit le module PHP qui a repondu. Un board kanban servi par un module
 * anterieur au §11 doit recevoir les six capacites nouvelles selon la table
 * §11.5 (derivees d'AUTRES capacites serveur) ; un board-lien qui ne les envoie
 * pas n'obtient rien — jamais un droit deduit d'un role (D10).
 */
import { describe, expect, test } from 'vitest';
import {
  boardSourceOf,
  cardStatusesFor,
  communecterStatusForColumn,
  completeCapabilities,
  dateZoneFor,
  elementTypeLabelKey,
  hasMilestones,
  isCommunecterBoard,
  isCommunecterColumnId,
  isOrganizationLink,
  isTranslatableColumnKey,
  labelsLanguageStale,
  linkMembershipRefusalKey,
  linkParentType,
  snapshotSource,
  toBoardSnapshot,
} from '@/modules/kanban/lib/boardSource';
import { KanbanApiError } from '@/modules/kanban/lib/kanbanErrors';
import en from '@/modules/kanban/i18n/en.json';
import fr from '@/modules/kanban/i18n/fr.json';
import type { BoardSnapshotPayload, CapabilitiesPayload } from '@/modules/kanban/types';
import { hasTranslation } from '../__fixtures__/i18nLookup';
import { makeBoard, makeMember, MILESTONES } from '../__fixtures__/snapshot';

const LEGACY_EDITOR: CapabilitiesPayload = {
  role: 'editor',
  canViewBoard: true,
  canEditCards: true,
  canManageColumns: true,
  canManageMembers: false,
  canEditBoard: false,
  canArchiveBoard: false,
  canDeleteBoard: false,
  canAttachBoard: false,
  canDetachBoard: false,
  canLeaveBoard: true,
  isExplicitOwner: false,
  archived: false,
};

describe('source', () => {
  test('un board sans source est un board kanban (aucune migration)', () => {
    expect(boardSourceOf({})).toBe('kanban');
    expect(boardSourceOf({ source: 'communecter' })).toBe('communecter');
    expect(isCommunecterBoard({ source: 'communecter' })).toBe(true);
    expect(isCommunecterBoard({})).toBe(false);
  });

  test('colonnes virtuelles et statut derive de la colonne', () => {
    expect(isCommunecterColumnId('totest')).toBe(true);
    expect(isCommunecterColumnId('doing')).toBe(false);
    expect(communecterStatusForColumn('done')).toBe('complete');
    expect(communecterStatusForColumn('tracking')).toBe('on_track');
    expect(communecterStatusForColumn('totest')).toBe('not_started');
  });

  test('statuts proposes par source', () => {
    expect(cardStatusesFor('communecter')).toEqual(['not_started', 'on_track', 'complete']);
    expect(cardStatusesFor('kanban')).toContain('in_research');
  });

  test('titres traduits : colonnes par defaut d un board kanban et six statuts d un board-lien, rien d autre', () => {
    for (const key of ['todo', 'doing', 'done', 'next', 'tracking', 'totest', 'discuter']) {
      expect(isTranslatableColumnKey(key), key).toBe(true);
    }
    expect(isTranslatableColumnKey('inattendu')).toBe(false);
    expect(isTranslatableColumnKey(null)).toBe(false);
    expect(isTranslatableColumnKey('')).toBe(false);
  });

  test('jour civil des dates : fuseau du navigateur sur un board-lien, UTC sur un board kanban', () => {
    expect(dateZoneFor('communecter')).toBe('local');
    expect(dateZoneFor('kanban')).toBe('utc');
  });
});

/*
 * §12 : le type de l'element d'un board-lien gouverne les jalons (D22) et les
 * textes declines par type. Un lien sans `parentType` sur le fil est un projet
 * (liens anterieurs au §12, aucune migration).
 */
describe('type de l element d un board-lien', () => {
  test('linkParentType : projet par defaut sur un lien, jamais rien sur un board kanban', () => {
    expect(linkParentType({ source: 'communecter', parentType: 'organizations' })).toBe('organizations');
    expect(linkParentType({ source: 'communecter', parentType: 'projects' })).toBe('projects');
    expect(linkParentType({ source: 'communecter', parentType: null })).toBe('projects');
    expect(linkParentType({ source: 'communecter' })).toBe('projects');
    // Le rattachement d'un board kanban a une organisation n'est pas une source.
    expect(linkParentType({ source: 'kanban', parentType: 'organizations' })).toBeNull();
    expect(linkParentType({ parentType: 'projects' })).toBeNull();
  });

  test('isOrganizationLink', () => {
    expect(isOrganizationLink({ source: 'communecter', parentType: 'organizations' })).toBe(true);
    expect(isOrganizationLink({ source: 'communecter', parentType: 'projects' })).toBe(false);
    expect(isOrganizationLink({ source: 'kanban', parentType: 'organizations' })).toBe(false);
  });

  test('hasMilestones : le board-lien d un PROJET seulement (D22)', () => {
    expect(hasMilestones({ source: 'communecter', parentType: 'projects' })).toBe(true);
    expect(hasMilestones({ source: 'communecter', parentType: null })).toBe(true);
    expect(hasMilestones({ source: 'communecter', parentType: 'organizations' })).toBe(false);
    expect(hasMilestones({ source: 'kanban', parentType: 'projects' })).toBe(false);
    expect(hasMilestones({})).toBe(false);
  });

  test('cle du libelle de type', () => {
    expect(elementTypeLabelKey('projects')).toBe('elements.type.projects');
    expect(elementTypeLabelKey('organizations')).toBe('elements.type.organizations');
  });
});

describe('linkMembershipRefusalKey : 403 notMember de board/create (§11.6, D19)', () => {
  const refused = (detail: Record<string, unknown>) => new KanbanApiError('notMember', { status: 403, code: 'notMember', detail });

  test('le type vient du detail du refus, sinon de l element choisi dans la boite', () => {
    expect(linkMembershipRefusalKey(refused({ parentType: 'organizations', parentId: 'o1' }), 'projects')).toBe(
      'boards.errors.notMember.organizations',
    );
    expect(linkMembershipRefusalKey(refused({ parentId: 'p1' }), 'projects')).toBe('boards.errors.notMember.projects');
    // Un type hors enumeration dans le detail : celui de la boite fait foi.
    expect(linkMembershipRefusalKey(refused({ parentType: 'events' }), 'organizations')).toBe('boards.errors.notMember.organizations');
  });

  test('tout autre echec : null — la traduction de la raison ou du code s applique', () => {
    const gone = new KanbanApiError('notFound', { status: 404, code: 'notFound', detail: { reason: 'sourceMissing' } });
    expect(linkMembershipRefusalKey(gone, 'projects')).toBeNull();
    expect(linkMembershipRefusalKey(new Error('boum'), 'projects')).toBeNull();
    expect(linkMembershipRefusalKey(null, 'projects')).toBeNull();
  });

  test('les deux textes existent, fr et en, et nomment l element plutot qu un « tableau »', () => {
    for (const type of ['projects', 'organizations']) {
      for (const catalog of [fr, en]) expect(hasTranslation(catalog, `boards.errors.notMember.${type}`), type).toBe(true);
    }
    expect(fr.boards.errors.notMember.projects).toMatch(/projet Communecter/);
    expect(fr.boards.errors.notMember.organizations).toMatch(/organisation Communecter/);
    expect(fr.boards.errors.notMember.projects).not.toMatch(/tableau\./);
  });
});

describe('langue des libelles servis (constat #32)', () => {
  const link = { capabilities: completeCapabilities(LEGACY_EDITOR, 'communecter') };
  const kanban = { capabilities: completeCapabilities(LEGACY_EDITOR, 'kanban') };

  test('board-lien servi dans une autre langue, ou de langue inconnue : a recharger', () => {
    expect(labelsLanguageStale({ ...link, servedLanguage: 'fr' }, 'en')).toBe(true);
    expect(labelsLanguageStale(link, 'fr')).toBe(true);
    expect(labelsLanguageStale({ ...link, servedLanguage: 'en' }, 'en')).toBe(false);
  });

  test('board kanban : jamais (ses colonnes se traduisent par `titleKey`)', () => {
    expect(labelsLanguageStale({ ...kanban, servedLanguage: 'fr' }, 'en')).toBe(false);
  });
});

describe('completeCapabilities', () => {
  test('board kanban anterieur au §11 : table §11.5, a partir des autres capacites', () => {
    expect(completeCapabilities(LEGACY_EDITOR, 'kanban')).toMatchObject({
      canReorderColumns: true,
      canRenameColumns: true,
      canArchiveCards: true,
      canManageMilestones: false,
      canEditCredits: false,
      // §12.3 : toleree absente, completee a `false` — jamais deduite du role.
      canManageRoles: false,
      source: 'kanban',
    });
    const archived = completeCapabilities({ ...LEGACY_EDITOR, canEditCards: false, canManageColumns: false }, 'kanban');
    expect(archived.canArchiveCards).toBe(false);
    expect(archived.canReorderColumns).toBe(false);
  });

  test('board-lien sans les cles nouvelles : rien n est permis, jamais deduit du role', () => {
    const caps = completeCapabilities({ ...LEGACY_EDITOR, role: 'owner' }, 'communecter');
    expect(caps).toMatchObject({
      canReorderColumns: false,
      canArchiveCards: false,
      canManageMilestones: false,
      canEditCredits: false,
      canManageRoles: false,
      source: 'communecter',
    });
  });

  test('canManageRoles envoyee par le serveur fait foi', () => {
    expect(completeCapabilities({ ...LEGACY_EDITOR, canManageRoles: true }, 'communecter').canManageRoles).toBe(true);
  });

  test('les cles envoyees par le serveur font foi', () => {
    const caps = completeCapabilities({ ...LEGACY_EDITOR, canArchiveCards: false, source: 'kanban' }, 'communecter');
    expect(caps.canArchiveCards).toBe(false);
    expect(caps.source).toBe('kanban');
  });
});

describe('toBoardSnapshot', () => {
  const payload: BoardSnapshotPayload = {
    board: makeBoard(),
    columns: [],
    cards: [],
    members: [makeMember('u1', 'owner', 'Alice')],
    capabilities: LEGACY_EDITOR,
  };

  test('jalons absents -> liste vide, capacites completes', () => {
    const snapshot = toBoardSnapshot(payload);
    expect(snapshot.milestones).toEqual([]);
    expect(snapshot.capabilities.canArchiveCards).toBe(true);
    expect(snapshotSource(snapshot)).toBe('kanban');
  });

  test('source lue sur le board quand les capacites ne la donnent pas', () => {
    const snapshot = toBoardSnapshot({
      ...payload,
      board: makeBoard({ source: 'communecter' }),
      milestones: MILESTONES,
    });
    expect(snapshotSource(snapshot)).toBe('communecter');
    expect(snapshot.milestones).toBe(MILESTONES);
  });

  test('une cle inconnue de la charge utile ne s installe pas dans le cache', () => {
    const snapshot = toBoardSnapshot({ ...payload, ...{ extra: 1 } });
    expect('extra' in snapshot).toBe(false);
  });
});
