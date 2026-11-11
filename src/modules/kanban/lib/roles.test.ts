/**
 * Logique pure du kanban des roles (`src/lib/roles.ts`, §12 D28-D29), partagee
 * avec le backend factice : les colonnes de `role/list`, la forme stockee des
 * listes et le cache optimiste de `useRoleMutations` sortent de la MEME regle.
 */
import { describe, expect, test } from 'vitest';
import {
  applyRoleWrite,
  assignRoleLocally,
  cleanRoleName,
  createRoleLocally,
  declaredRoleNames,
  deleteRoleLocally,
  findRoleMember,
  isSameRoleMember,
  isValidRoleName,
  ROLE_NAME_MAX_LENGTH,
  roleColumnsFor,
  roleHolderCount,
  roleNameLength,
  storedRoles,
  unassignRoleLocally,
  withRolesRev,
} from '@/modules/kanban/lib/roles';
import type { RoleListResult, RoleMember } from '@/modules/kanban/types';

function member(id: string, roles: string[], overrides: Partial<RoleMember> = {}): RoleMember {
  return { id, type: 'citoyens', name: id, slug: id, image: null, isAdmin: false, pending: false, roles, ...overrides };
}

const CAMILLE = member('u1', ['Coordination'], { isAdmin: true });
const YANIS = member('u2', ['Communication', 'Dev']);
const TOM = member('u3', ['Communication']);
const PARTNER = member('o1', ['Partenaire'], { type: 'organizations' });
/** Une organisation membre qui porte l'ID d'un citoyen : impossible en base, mais c'est la paire id + type qui identifie (D28). */
const HOMONYM = member('u3', [], { type: 'organizations', name: 'Homonyme' });

const LIST: RoleListResult = {
  roles: roleColumnsFor(['Coordination', 'Communication', 'Trésorerie'], [CAMILLE, YANIS, TOM, PARTNER]),
  members: [CAMILLE, YANIS, TOM, PARTNER],
  canManageRoles: true,
  rev: 4,
};

const citizen = (id: string) => ({ id, type: 'citoyens' as const });

describe('libelles (D29) — miroir de `SourceRoles::normalizeLabel`', () => {
  test('cleanRoleName : trim a la PHP, rien d autre (ni casse ni accents, comme `cleanRole` de kanban.php)', () => {
    expect(cleanRoleName('  Trésorerie ')).toBe('Trésorerie');
    expect(cleanRoleName('\t\nAccueil\r\0\x0B')).toBe('Accueil');
    expect(cleanRoleName('TRÉSORERIE')).toBe('TRÉSORERIE');
    expect(cleanRoleName(42)).toBe('');
  });

  test('trim : les blancs Unicode restent, comme `trim()` de PHP (une espace insecable fait partie du libelle stocke)', () => {
    // `String.prototype.trim` les retirerait : le front verrait « Accueil »
    // quand le serveur stocke «  Accueil » — deux colonnes pour un role.
    expect(cleanRoleName('\u00A0Accueil')).toBe('\u00A0Accueil');
    expect(cleanRoleName('Accueil\u2003')).toBe('Accueil\u2003');
  });

  test('isValidRoleName : non vide, 60 au plus, sans < > ni caractere refuse', () => {
    expect(isValidRoleName('Communication')).toBe(true);
    expect(isValidRoleName('  Accueil & café ')).toBe(true);
    expect(isValidRoleName('')).toBe(false);
    expect(isValidRoleName('   ')).toBe(false);
    expect(isValidRoleName('x'.repeat(ROLE_NAME_MAX_LENGTH + 1))).toBe(false);
    expect(isValidRoleName('x'.repeat(ROLE_NAME_MAX_LENGTH))).toBe(true);
    expect(isValidRoleName('<b>Admin</b>')).toBe(false);
    expect(isValidRoleName('a > b')).toBe(false);
    expect(isValidRoleName(null)).toBe(false);
  });

  test('longueur en POINTS DE CODE (`mb_strlen`) : un emoji compte 1, un libelle de 60 points dont un emoji passe', () => {
    const withEmoji = `${'x'.repeat(ROLE_NAME_MAX_LENGTH - 1)}😀`;
    expect(withEmoji.length).toBe(ROLE_NAME_MAX_LENGTH + 1);
    expect(roleNameLength(withEmoji)).toBe(ROLE_NAME_MAX_LENGTH);
    expect(isValidRoleName(withEmoji)).toBe(true);
    expect(isValidRoleName(`${withEmoji}x`)).toBe(false);
  });

  test('caracteres de controle : le motif du PHP (`CONTROL_CHARS_PATTERN`), tab / LF / CR internes toleres, U+E000 refuse', () => {
    // C0 hors tabulation et retours, et DEL : refuses.
    for (const code of [0x00, 0x08, 0x0b, 0x0c, 0x0e, 0x1f, 0x7f]) {
      expect(isValidRoleName(`a${String.fromCharCode(code)}b`), `U+${code.toString(16)}`).toBe(false);
    }
    // Tabulation, saut de ligne, retour chariot : le PHP les garde (sauf aux bouts, trimes).
    expect(isValidRoleName('tab\there')).toBe(true);
    expect(isValidRoleName('deux\nlignes')).toBe(true);
    expect(isValidRoleName('retour\rchariot')).toBe(true);
    // Le jeton interne de `sanitizeText` (`ANGLE_TOKEN`).
    expect(isValidRoleName('a\uE000b')).toBe(false);
    // Les C1 passent : le motif PHP, octet par octet sans `u`, ne les voit pas.
    expect(isValidRoleName('a\u0085b')).toBe(true);
  });

  test('storedRoles (D29) : liste vide = `null` (`$unset`, la cle disparait), sinon une copie', () => {
    expect(storedRoles([])).toBeNull();
    const roles = ['Accueil'];
    const stored = storedRoles(roles);
    expect(stored).toEqual(['Accueil']);
    expect(stored).not.toBe(roles);
  });
});

describe('identite d un membre (D28) : la paire id + type', () => {
  test('isSameRoleMember et findRoleMember distinguent un citoyen d une organisation homonyme', () => {
    expect(isSameRoleMember(TOM, citizen('u3'))).toBe(true);
    expect(isSameRoleMember(HOMONYM, citizen('u3'))).toBe(false);
    const list = { members: [TOM, HOMONYM] };
    expect(findRoleMember(list, 'u3', 'citoyens')).toBe(TOM);
    expect(findRoleMember(list, 'u3', 'organizations')).toBe(HOMONYM);
    expect(findRoleMember(list, 'u9', 'citoyens')).toBeUndefined();
  });
});

describe('roleColumnsFor (D28)', () => {
  test('declares d abord dans leur ordre, puis portes dans l ordre des membres ; union sans doublon', () => {
    expect(LIST.roles).toEqual([
      { name: 'Coordination', declared: true, memberIds: ['u1'] },
      { name: 'Communication', declared: true, memberIds: ['u2', 'u3'] },
      { name: 'Trésorerie', declared: true, memberIds: [] },
      { name: 'Dev', declared: false, memberIds: ['u2'] },
      { name: 'Partenaire', declared: false, memberIds: ['o1'] },
    ]);
  });

  test('comparaison exacte apres trim : « Dev » et « dev » sont deux colonnes, «  Dev » n en est pas une de plus', () => {
    const columns = roleColumnsFor([' Dev'], [member('a', ['dev']), member('b', ['Dev '])]);
    expect(columns.map((entry) => [entry.name, entry.declared, entry.memberIds])).toEqual([
      ['Dev', true, ['b']],
      ['dev', false, ['a']],
    ]);
  });

  test('libelles vides et doublons declares ignores', () => {
    expect(roleColumnsFor(['', 'A', 'A', '  '], [member('a', ['', 'A'])])).toEqual([{ name: 'A', declared: true, memberIds: ['a'] }]);
  });

  test('porteurs comptes par colonne', () => {
    expect(roleHolderCount(LIST.roles[1])).toBe(2);
    expect(declaredRoleNames(LIST)).toEqual(['Coordination', 'Communication', 'Trésorerie']);
  });
});

describe('cache optimiste', () => {
  test('assignRoleLocally : le membre gagne le role, la colonne devient declaree ; idempotent', () => {
    const next = assignRoleLocally(LIST, citizen('u3'), 'Dev');
    expect(findRoleMember(next, 'u3', 'citoyens')?.roles).toEqual(['Communication', 'Dev']);
    expect(next.roles.find((entry) => entry.name === 'Dev')).toEqual({ name: 'Dev', declared: true, memberIds: ['u2', 'u3'] });
    expect(assignRoleLocally(next, citizen('u3'), 'Dev')).toEqual(next);
    // Inconnu : rien ne change (le serveur repondra 404 `notLinked`).
    expect(assignRoleLocally(LIST, citizen('u9'), 'Dev').members).toEqual(LIST.members);
    // La source n'est jamais mutee.
    expect(TOM.roles).toEqual(['Communication']);
  });

  test('assignRoleLocally / unassignRoleLocally : le TYPE fait partie de l identite — un homonyme d un autre type n est pas touche', () => {
    const list: RoleListResult = { ...LIST, members: [...LIST.members, HOMONYM] };
    const assigned = assignRoleLocally(list, { id: 'u3', type: 'organizations' }, 'Dev');
    expect(findRoleMember(assigned, 'u3', 'organizations')?.roles).toEqual(['Dev']);
    expect(findRoleMember(assigned, 'u3', 'citoyens')?.roles).toEqual(['Communication']);
    const unassigned = unassignRoleLocally(list, { id: 'u3', type: 'organizations' }, 'Communication');
    expect(findRoleMember(unassigned, 'u3', 'citoyens')?.roles).toEqual(['Communication']);
  });

  test('unassignRoleLocally : une colonne NON declaree qui perd son dernier porteur disparait', () => {
    const next = unassignRoleLocally(LIST, citizen('u2'), 'Dev');
    expect(findRoleMember(next, 'u2', 'citoyens')?.roles).toEqual(['Communication']);
    expect(next.roles.some((entry) => entry.name === 'Dev')).toBe(false);
    // Une colonne DECLAREE survit, vide.
    const emptied = unassignRoleLocally(LIST, citizen('u1'), 'Coordination');
    expect(emptied.roles.find((entry) => entry.name === 'Coordination')).toEqual({ name: 'Coordination', declared: true, memberIds: [] });
  });

  test('createRoleLocally : colonne declaree sans porteur ; un role porte devient declare', () => {
    const created = createRoleLocally(LIST, ' Accueil ').roles;
    // Declaree : rangee APRES les declarees, AVANT les seulement portees (D28).
    expect(created.map((entry) => entry.name)).toEqual(['Coordination', 'Communication', 'Trésorerie', 'Accueil', 'Dev', 'Partenaire']);
    expect(created[3]).toEqual({ name: 'Accueil', declared: true, memberIds: [] });
    expect(createRoleLocally(LIST, 'Dev').roles.find((entry) => entry.name === 'Dev')?.declared).toBe(true);
    expect(createRoleLocally(LIST, '   ')).toEqual(LIST);
  });

  test('deleteRoleLocally : retire de chaque porteur et des declares', () => {
    const next = deleteRoleLocally(LIST, 'Communication');
    expect(next.roles.map((entry) => entry.name)).toEqual(['Coordination', 'Trésorerie', 'Dev', 'Partenaire']);
    expect(findRoleMember(next, 'u2', 'citoyens')?.roles).toEqual(['Dev']);
    expect(findRoleMember(next, 'u3', 'citoyens')?.roles).toEqual([]);
  });

  test('applyRoleWrite : la liste COMPLETE du membre et la revision font autorite', () => {
    const next = applyRoleWrite(LIST, { member: { id: 'u2', type: 'citoyens', roles: ['Dev'] }, changed: true, rev: 9 });
    expect(next.rev).toBe(9);
    expect(findRoleMember(next, 'u2', 'citoyens')?.roles).toEqual(['Dev']);
    expect(next.roles.find((entry) => entry.name === 'Communication')?.memberIds).toEqual(['u3']);
    // Un homonyme d'un autre type n'est pas touche.
    const organization = applyRoleWrite(LIST, { member: { id: 'u2', type: 'organizations', roles: [] }, changed: true, rev: 9 });
    expect(findRoleMember(organization, 'u2', 'citoyens')?.roles).toEqual(['Communication', 'Dev']);
  });

  test('withRolesRev : la revision avance, jamais ne redescend (reponse d une ecriture plus ancienne)', () => {
    expect(withRolesRev(LIST, 7).rev).toBe(7);
    expect(withRolesRev(LIST, 3)).toBe(LIST);
    expect(withRolesRev(LIST, 4)).toBe(LIST);
    expect(applyRoleWrite(LIST, { member: { id: 'u2', type: 'citoyens', roles: ['Dev'] }, changed: true, rev: 2 }).rev).toBe(4);
  });
});
