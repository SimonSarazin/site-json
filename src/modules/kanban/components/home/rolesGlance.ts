import { rolesSummary } from '@/modules/kanban/components/roles/rolesBoard';
import type { RoleListResult, RoleMember } from '@/modules/kanban/types';

/** Ce que la tuile « Rôles » de `/kanban` dit de la liste des rôles. */
export interface RolesGlance {
  roleCount: number;
  memberCount: number;
  /** Rôles déclarés que personne ne tient : ce qui reste à attribuer. */
  vacantRoleCount: number;
  /** Portraits affichés : les titulaires d'un rôle d'abord, chacun dans l'ordre du serveur. */
  faces: RoleMember[];
  /** Membres au-delà des portraits : la pastille « +N ». */
  hiddenFaces: number;
}

/**
 * Aperçu de la liste des rôles (`role/list`) pour sa tuile. Les titulaires passent devant : la
 * tuile parle des rôles, et dans un collectif nombreux les premiers membres servis n'en tiennent
 * souvent aucun. Pure et testée.
 */
export function rolesGlance(list: Pick<RoleListResult, 'roles' | 'members'>, maxFaces: number): RolesGlance {
  const { memberCount, roleCount } = rolesSummary(list);
  const holderIds = new Set(list.roles.flatMap((role) => role.memberIds));
  const holders = list.members.filter((member) => holderIds.has(member.id));
  const others = list.members.filter((member) => !holderIds.has(member.id));
  const faces = [...holders, ...others].slice(0, Math.max(0, maxFaces));
  return {
    roleCount,
    memberCount,
    vacantRoleCount: list.roles.filter((role) => role.memberIds.length === 0).length,
    faces,
    hiddenFaces: memberCount - faces.length,
  };
}
