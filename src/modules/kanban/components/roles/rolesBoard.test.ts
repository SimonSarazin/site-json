/**
 * Logique PURE du kanban des roles (`components/roles/rolesBoard.ts`) :
 * recherche sur le nom ET les roles dans toutes les
 * colonnes, colonnes dans l'ordre du serveur, decision du depot (copie, jamais
 * deux fois), place du fantome, messages d'annonce, validation du composeur.
 */
import { describe, expect, test } from 'vitest';
import {
  buildRolesBoard,
  canReceive,
  checkRoleName,
  dragCancelMessage,
  dragEndMessage,
  dragOverMessage,
  dragStartMessage,
  ghostIndex,
  isMemberDragData,
  isRoleDropData,
  memberDragId,
  memberHoldsRole,
  memberKey,
  memberMatches,
  resolveDrop,
  roleDropId,
  roleWriteRefusedMessage,
  rolesSummary,
  searchNeedle,
  visibleRoleColumns,
} from '@/modules/kanban/components/roles/rolesBoard';
import type { RoleListResult, RoleMember } from '@/modules/kanban/types';

function member(id: string, name: string, roles: string[], overrides: Partial<RoleMember> = {}): RoleMember {
  return { id, type: 'citoyens', name, slug: id, image: null, isAdmin: false, pending: false, roles, ...overrides };
}

const LIST: RoleListResult = {
  roles: [
    { name: 'Coordination', declared: true, memberIds: ['u1', 'u3'] },
    { name: 'Trésorerie', declared: true, memberIds: [] },
    { name: 'Dev', declared: false, memberIds: ['u2'] },
  ],
  members: [
    member('u1', 'Camille Dubois', ['Coordination'], { isAdmin: true }),
    member('u2', 'Yanis Rakoto', ['Dev']),
    member('u3', 'Marc Hoarau', ['Coordination'], { pending: true }),
    member('o1', 'Les Jardins du Port', ['Partenaire'], { type: 'organizations' }),
  ],
  canManageRoles: true,
  rev: 3,
};

describe('recherche', () => {
  test('aiguille sans accents ni casse, blancs ignores ; vide = tout passe', () => {
    expect(searchNeedle('  Trésorerie ')).toBe('tresorerie');
    expect(memberMatches(LIST.members[0], '')).toBe(true);
  });

  test('un membre correspond par son nom OU par un de ses roles', () => {
    expect(memberMatches(LIST.members[0], 'dubois')).toBe(true);
    expect(memberMatches(LIST.members[0], 'coord')).toBe(true);
    expect(memberMatches(LIST.members[1], 'coord')).toBe(false);
    // Accents : « Trésorerie » se trouve sans accent, et inversement.
    expect(memberMatches(member('x', 'X', ['Trésorerie']), 'tresor')).toBe(true);
  });
});

describe('buildRolesBoard', () => {
  test('colonnes dans l ordre du serveur, porteurs dans l ordre des membres, capsules sur les porteurs reels', () => {
    const board = buildRolesBoard(LIST, '');
    expect(board.columns.map((column) => column.role.name)).toEqual(['Coordination', 'Trésorerie', 'Dev']);
    expect(board.columns[0].holders.map((holder) => holder.id)).toEqual(['u1', 'u3']);
    expect(board.columns[1].holders).toEqual([]);
    expect(board.columns[1].holderCount).toBe(0);
    expect(board.memberCount).toBe(4);
    expect(board.filtering).toBe(false);
    expect(board.matchCount).toBe(4);
  });

  test('la recherche filtre « Membres » ET les colonnes de role, les capsules ne bougent pas', () => {
    const board = buildRolesBoard(LIST, 'coord');
    expect(board.members.map((entry) => entry.id)).toEqual(['u1', 'u3']);
    expect(board.columns[0].holders.map((holder) => holder.id)).toEqual(['u1', 'u3']);
    expect(board.columns[2].holders).toEqual([]);
    // Le compteur de l'en-tete dit toujours combien portent le role.
    expect(board.columns[2].holderCount).toBe(1);
    expect(board.filtering).toBe(true);
    expect(board.matchCount).toBe(2);
  });

  test('un porteur sans fiche (course avec un depart) est ignore, jamais rendu comme un id', () => {
    const list = { ...LIST, roles: [{ name: 'Coordination', declared: true, memberIds: ['u1', 'parti'] }] };
    const board = buildRolesBoard(list, '');
    expect(board.columns[0].holders.map((holder) => holder.id)).toEqual(['u1']);
    expect(board.columns[0].holderCount).toBe(1);
  });

  test('resume : N membres, M roles', () => {
    expect(rolesSummary(LIST)).toEqual({ memberCount: 4, roleCount: 3 });
  });
});

describe('glisser-deposer', () => {
  test('identifiants prefixes et gardes de donnees, sans `as`', () => {
    expect(memberKey(LIST.members[3])).toBe('organizations:o1');
    expect(memberDragId(LIST.members[0])).toBe('member:citoyens:u1');
    expect(roleDropId('Dev')).toBe('role:Dev');
    expect(isMemberDragData({ type: 'member', memberId: 'u1', memberType: 'citoyens' })).toBe(true);
    expect(isMemberDragData({ type: 'member', memberId: 'u1', memberType: 'events' })).toBe(false);
    expect(isMemberDragData({ type: 'role', role: 'Dev' })).toBe(false);
    expect(isRoleDropData({ type: 'role', role: 'Dev' })).toBe(true);
    expect(isRoleDropData(null)).toBe(false);
    // La zone de « Membres » est dite pour ce qu'elle est : jamais une cible de role.
    expect(isRoleDropData({ type: 'members' })).toBe(false);
  });

  test('une colonne accepte un membre qui ne la porte pas encore ; deja porte = refus dit, hors colonne = rien', () => {
    expect(canReceive(LIST.roles[0], 'u2')).toBe(true);
    expect(canReceive(LIST.roles[0], 'u1')).toBe(false);
    expect(resolveDrop({ type: 'role', role: 'Trésorerie' }, LIST.roles, 'u1')).toEqual({ kind: 'assign', role: 'Trésorerie' });
    expect(resolveDrop({ type: 'role', role: 'Coordination' }, LIST.roles, 'u1')).toEqual({ kind: 'alreadyHeld', role: 'Coordination' });
    // Colonne disparue entre le survol et le lacher (suppression distante) : rien.
    expect(resolveDrop({ type: 'role', role: 'Disparu' }, LIST.roles, 'u1')).toEqual({ kind: 'none' });
    expect(resolveDrop(undefined, LIST.roles, 'u1')).toEqual({ kind: 'none' });
    expect(resolveDrop({ type: 'members' }, LIST.roles, 'u1')).toEqual({ kind: 'none' });
  });

  test('refus du serveur apres une ecriture optimiste : la region redit l etat vrai, avec la raison', () => {
    expect(roleWriteRefusedMessage('assign', 'Tom', 'Dev', 'Plus lié.')).toEqual({
      key: 'views.roles.assignRefused',
      values: { name: 'Tom', role: 'Dev', reason: 'Plus lié.' },
    });
    expect(roleWriteRefusedMessage('unassign', 'Tom', 'Dev', 'Archivé.')).toEqual({
      key: 'views.roles.removeRefused',
      values: { name: 'Tom', role: 'Dev', reason: 'Archivé.' },
    });
  });

  test('le fantome prend la place du membre dans l ordre des membres, pas celle du pointeur', () => {
    const order = ['u1', 'u2', 'u3', 'o1'];
    expect(ghostIndex(['u1', 'u3'], order, 'u2')).toBe(1);
    expect(ghostIndex(['u1', 'u3'], order, 'o1')).toBe(2);
    expect(ghostIndex([], order, 'u2')).toBe(0);
    // Inconnu de l'ordre : en fin de colonne.
    expect(ghostIndex(['u1'], order, 'zz')).toBe(1);
  });

  test('annonces : saisie, survol (silence hors colonne), lacher et annulation', () => {
    expect(dragStartMessage('Camille')).toEqual({ key: 'views.roles.dragStart', values: { name: 'Camille' } });
    expect(dragOverMessage('Camille', { kind: 'assign', role: 'Dev' })).toEqual({
      key: 'views.roles.dragOver',
      values: { name: 'Camille', role: 'Dev' },
    });
    expect(dragOverMessage('Camille', { kind: 'alreadyHeld', role: 'Dev' })?.key).toBe('views.roles.alreadyAssigned');
    expect(dragOverMessage('Camille', { kind: 'none' })).toBeUndefined();
    expect(dragEndMessage('Camille', { kind: 'assign', role: 'Dev' }).key).toBe('views.roles.assigned');
    expect(dragEndMessage('Camille', { kind: 'alreadyHeld', role: 'Dev' }).key).toBe('views.roles.alreadyAssigned');
    expect(dragEndMessage('Camille', { kind: 'none' })).toEqual({ key: 'views.roles.dragOutside', values: { name: 'Camille' } });
    expect(dragCancelMessage('Camille').key).toBe('views.roles.dragCancelled');
  });
});

describe('composeur et boite « Rôles… »', () => {
  const existing = LIST.roles.map((role) => role.name);

  test('libelle vide, trop long, interdit, deja pris ; sinon le libelle trim', () => {
    expect(checkRoleName('   ', existing)).toEqual({ ok: false, problem: 'roleRequired', name: '' });
    expect(checkRoleName('x'.repeat(61), existing).ok).toBe(false);
    expect(checkRoleName('x'.repeat(61), existing)).toMatchObject({ problem: 'roleTooLong' });
    // Points de code comme `mb_strlen` cote serveur : 60 emojis (120 unites
    // UTF-16) passent ici comme la-bas, 61 non.
    expect(checkRoleName('😀'.repeat(60), existing)).toEqual({ ok: true, name: '😀'.repeat(60) });
    expect(checkRoleName('😀'.repeat(61), existing)).toMatchObject({ problem: 'roleTooLong' });
    expect(checkRoleName('<script>', existing)).toMatchObject({ problem: 'roleInvalid' });
    expect(checkRoleName('  Coordination ', existing)).toMatchObject({ problem: 'roleExists' });
    // Casse et accents comptent (comparaison exacte, comme Communecter).
    expect(checkRoleName('coordination', existing)).toEqual({ ok: true, name: 'coordination' });
    expect(checkRoleName('  Accueil ', existing)).toEqual({ ok: true, name: 'Accueil' });
  });

  test('un membre porte un role : comparaison exacte apres trim', () => {
    expect(memberHoldsRole(LIST.members[0], ' Coordination ')).toBe(true);
    expect(memberHoldsRole(LIST.members[0], 'coordination')).toBe(false);
  });
});

describe('colonnes de role rendues (masquage local)', () => {
  test('retire les colonnes masquees, garde l ordre du serveur, ignore un nom inconnu', () => {
    const { columns } = buildRolesBoard(LIST, '');
    expect(visibleRoleColumns(columns, []).map((column) => column.role.name)).toEqual(['Coordination', 'Trésorerie', 'Dev']);
    expect(visibleRoleColumns(columns, ['Trésorerie', 'Disparu']).map((column) => column.role.name)).toEqual(['Coordination', 'Dev']);
    expect(visibleRoleColumns(columns, ['Coordination', 'Trésorerie', 'Dev'])).toEqual([]);
    // Jamais le tableau recu : l'appelant peut le garder tel quel.
    expect(visibleRoleColumns(columns, [])).not.toBe(columns);
  });
});
