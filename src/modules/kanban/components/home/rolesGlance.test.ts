import { describe, expect, test } from 'vitest';
import type { RoleEntry, RoleMember } from '@/modules/kanban/types';
import { rolesGlance } from './rolesGlance';

function member(id: string, roles: string[] = []): RoleMember {
  return { id, type: 'citoyens', name: id, slug: id, image: null, isAdmin: false, pending: false, roles };
}

function role(name: string, memberIds: string[], declared = true): RoleEntry {
  return { name, declared, memberIds };
}

describe('rolesGlance', () => {
  test('compte les rôles, les membres et les rôles déclarés sans titulaire', () => {
    const glance = rolesGlance(
      {
        roles: [role('Présidence', ['m2']), role('Trésorerie', []), role('Coach', ['m3', 'm4'], false), role('Secrétariat', [])],
        members: [member('m1'), member('m2', ['Présidence']), member('m3', ['Coach']), member('m4', ['Coach'])],
      },
      8,
    );
    expect(glance).toMatchObject({ roleCount: 4, memberCount: 4, vacantRoleCount: 2, hiddenFaces: 0 });
  });

  test('les titulaires passent devant, puis les autres, chacun dans l ordre du serveur', () => {
    const glance = rolesGlance(
      { roles: [role('Coach', ['m4', 'm2'])], members: [member('m1'), member('m2', ['Coach']), member('m3'), member('m4', ['Coach'])] },
      3,
    );
    expect(glance.faces.map((face) => face.id)).toEqual(['m2', 'm4', 'm1']);
    expect(glance.hiddenFaces).toBe(1);
  });

  test('liste vide : rien à montrer', () => {
    expect(rolesGlance({ roles: [], members: [] }, 6)).toEqual({ roleCount: 0, memberCount: 0, vacantRoleCount: 0, faces: [], hiddenFaces: 0 });
  });
});
