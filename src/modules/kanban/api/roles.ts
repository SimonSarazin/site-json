/**
 * Routes `role/*` de l'API kanban (blueprint §12.3, D27-D30) : le
 * kanban des ROLES d'un element Communecter (projet ou organisation).
 *
 * Les roles sont ceux de la plateforme — `roles` de l'element (declares) et
 * `links.<memberOf|projects>.<element>.roles` de chaque membre (portes), lus
 * cote membre comme le fait le kanban de Communecter (D28). Lecture : editeur du
 * board-lien ; ecriture : administrateur de l'element (`canManageRoles`), qui
 * reecrit la liste complete des deux cotes du lien (D29) sous l'identite de la
 * requete. Sur un board kanban, toutes ces routes repondent 409 `notSourceBoard`.
 *
 * Chaque fonction impose une garde de type sur la reponse : un module qui
 * devie du contrat echoue ici, pas dans la vue.
 */
import type { KanbanClient, KanbanRequestOptions } from '@/modules/kanban/transport/kanbanClient';
import {
  isRoleCreateResult,
  isRoleDeleteResult,
  isRoleListResult,
  isRoleWriteResult,
  type RoleCreateResult,
  type RoleDeleteResult,
  type RoleListResult,
  type RoleMemberType,
  type RoleWriteResult,
} from '@/modules/kanban/types';

export function listRoles(
  client: KanbanClient,
  boardId: string,
  options?: KanbanRequestOptions,
): Promise<RoleListResult> {
  return client.call('KANBAN_ROLE_LIST_URL', (kanban) => kanban.role.list({ boardId }), isRoleListResult, options);
}

export type RoleNameInput = {
  boardId: string;
  /**
   * Libelle TEL QUE SAISI : c'est le serveur qui `trim` et refuse (422
   * `invalidRole`, borne `ROLE_NAME_MAX_LENGTH` de `lib/roles.ts` — la seule
   * definition, partagee avec le composeur).
   */
  role: string;
};

/** Declare un role dans `roles` de l'element ; deja declare : `created: false`, rien d'ecrit. */
export function createRole(
  client: KanbanClient,
  input: RoleNameInput,
  options?: KanbanRequestOptions,
): Promise<RoleCreateResult> {
  return client.call('KANBAN_ROLE_CREATE_URL', (kanban) => kanban.role.create(input), isRoleCreateResult, options);
}

export type RoleMemberInput = RoleNameInput & {
  memberId: string;
  memberType: RoleMemberType;
};

/** Ajoute le role a la liste du membre (des deux cotes du lien) ; deja porte : `changed: false`. */
export function assignRole(
  client: KanbanClient,
  input: RoleMemberInput,
  options?: KanbanRequestOptions,
): Promise<RoleWriteResult> {
  return client.call('KANBAN_ROLE_ASSIGN_URL', (kanban) => kanban.role.assign(input), isRoleWriteResult, options);
}

/** Retire le role de la liste du membre ; liste vide = `$unset` des deux cotes (D29). */
export function unassignRole(
  client: KanbanClient,
  input: RoleMemberInput,
  options?: KanbanRequestOptions,
): Promise<RoleWriteResult> {
  return client.call('KANBAN_ROLE_UNASSIGN_URL', (kanban) => kanban.role.unassign(input), isRoleWriteResult, options);
}

/** Retire le role de chaque porteur, puis de `roles` de l'element ; `removedFrom` compte les porteurs. */
export function deleteRole(
  client: KanbanClient,
  input: RoleNameInput,
  options?: KanbanRequestOptions,
): Promise<RoleDeleteResult> {
  return client.call('KANBAN_ROLE_DELETE_URL', (kanban) => kanban.role.delete(input), isRoleDeleteResult, options);
}
