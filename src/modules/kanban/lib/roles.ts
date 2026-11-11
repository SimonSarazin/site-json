/**
 * Roles d'un element Communecter — logique PURE du kanban des roles (§12,
 * D27-D30) : cache optimiste de `useRoleMutations`, colonnes de `role/list` et
 * forme stockee des listes, miroir des regles de D28 et D29 du PHP.
 *
 * Copie de co-kanban, ou son backend factice l'importe aussi : des imports de
 * TYPES seulement, pour que les deux copies restent comparables.
 */
import type {
  RoleEntry,
  RoleListResult,
  RoleMember,
  RoleMemberType,
  RoleWriteResult,
} from '@/modules/kanban/types';

/* -------------------------------------------------------------------------- */
/*  Libelles (D29) — miroir EXACT de `SourceRoles::normalizeLabel` (PHP)        */
/* -------------------------------------------------------------------------- */

/**
 * Borne du libelle d'un role (`SourceRoles::MAX_LABEL`), comptee en POINTS DE
 * CODE comme `mb_strlen` — UNE definition, lue par le composeur et la
 * validation locale.
 */
export const ROLE_NAME_MAX_LENGTH = 60;

/**
 * Caractere refuse dans un libelle (D29), decide par CODE de caractere plutot que
 * par un motif (parite PHP lisible, et aucun caractere de controle dans une
 * expression reguliere) : les chevrons (aucune balise stockable, gestion
 * n'echappe qu'a l'affichage), les caracteres de controle que le module retire
 * de tout texte (`KanbanInput::CONTROL_CHARS_PATTERN` : C0 sauf tabulation,
 * saut de ligne et retour chariot, plus DEL) et le jeton interne U+E000
 * (`KanbanInput::ANGLE_TOKEN`). Tabulation, LF et CR INTERNES passent, comme
 * cote PHP ; les C1 (U+0080-U+009F) aussi — le motif PHP, octet par octet, ne
 * les voit pas. Lu en unites UTF-16 : une moitie de paire de substitution
 * (U+D800-U+DFFF) n'est jamais dans l'ensemble.
 */
function isForbiddenRoleCharacter(code: number): boolean {
  if (code === 0x3c || code === 0x3e) return true;
  if (code <= 0x08 || code === 0x0b || code === 0x0c) return true;
  if (code >= 0x0e && code <= 0x1f) return true;
  return code === 0x7f || code === 0xe000;
}

function hasForbiddenRoleCharacter(name: string): boolean {
  for (let index = 0; index < name.length; index += 1) {
    if (isForbiddenRoleCharacter(name.charCodeAt(index))) return true;
  }
  return false;
}

/**
 * Caracteres que `trim()` de PHP retire aux deux bouts : espace, tabulation,
 * saut de ligne, retour chariot, NUL, tabulation verticale — et rien d'autre.
 * Celui de JavaScript retire aussi les blancs Unicode (espace insecable U+00A0,
 * U+2028…) : un libelle precede d'une espace insecable serait vu « Accueil »
 * ici et stocke avec son espace par le serveur — deux colonnes pour un seul
 * role jusqu'a la relecture.
 */
const PHP_TRIM_CODES: ReadonlySet<number> = new Set([0x20, 0x09, 0x0a, 0x0d, 0x00, 0x0b]);

function phpTrim(value: string): string {
  let start = 0;
  let end = value.length;
  while (start < end && PHP_TRIM_CODES.has(value.charCodeAt(start))) start += 1;
  while (end > start && PHP_TRIM_CODES.has(value.charCodeAt(end - 1))) end -= 1;
  return value.slice(start, end);
}

/** Libelle normalise comme le module (`SourceRoles::normalizeLabel`) : `trim` a la PHP, rien d'autre — ni casse ni accents. */
export function cleanRoleName(value: unknown): string {
  return typeof value === 'string' ? phpTrim(value) : '';
}

/** Longueur d'un libelle en points de code (`mb_strlen`) : un emoji compte 1, pas 2 unites UTF-16. */
export function roleNameLength(name: string): number {
  return [...name].length;
}

/**
 * Libelle acceptable pour `role/create` et `role/assign` (D29) : `trim`e, non
 * vide, `ROLE_NAME_MAX_LENGTH` points de code au plus, sans chevron ni caractere
 * refuse. Le serveur refuse le reste en 422 `invalidRole` ; verifier ici evite
 * un aller-retour et nomme le champ dans le composeur — a condition que la
 * regle soit la MEME, d'ou le miroir point par point du PHP.
 */
export function isValidRoleName(value: unknown): value is string {
  const name = cleanRoleName(value);
  if (name === '' || roleNameLength(name) > ROLE_NAME_MAX_LENGTH) return false;
  return !hasForbiddenRoleCharacter(name);
}

/** Un seul exemplaire de chaque libelle non vide, premier vu premier garde. */
function uniqueRoleNames(values: readonly string[]): string[] {
  const out: string[] = [];
  for (const value of values) {
    const name = cleanRoleName(value);
    if (name !== '' && !out.includes(name)) out.push(name);
  }
  return out;
}

/**
 * Forme STOCKEE d'une liste de roles reecrite des deux cotes du lien (D29,
 * `Link::removeRole`) : un tableau, ou `null` quand la liste est vide — le
 * membre n'a alors plus de cle `roles` (`$unset`), jamais un `[]`. Le backend
 * factice ecrit cette forme ; l'empreinte PHP (`fingerprintOf`) ignore les
 * listes vides pour la meme raison.
 */
export function storedRoles(roles: readonly string[]): string[] | null {
  return roles.length === 0 ? null : [...roles];
}

/* -------------------------------------------------------------------------- */
/*  Identite d'un membre (D28)                                                 */
/* -------------------------------------------------------------------------- */

/** Ce qui identifie un membre d'element : son id ET son type — un citoyen et une organisation sont deux membres. */
export type RoleMemberIdentity = Pick<RoleMember, 'id' | 'type'>;

/**
 * UNE convention d'identite pour tout le module : la paire `id` + `type`, celle
 * que l'API exige (`memberId`, `memberType`) et que `role/assign` renvoie. Un
 * citoyen et une organisation membre ne partagent pas d'ObjectId aujourd'hui ;
 * la paire ne coute rien et survit a un backend qui servirait d'autres ids.
 */
export function isSameRoleMember(left: RoleMemberIdentity, right: RoleMemberIdentity): boolean {
  return left.id === right.id && left.type === right.type;
}

/** Membre d'une liste par identifiant et type. */
export function findRoleMember(
  list: Pick<RoleListResult, 'members'>,
  memberId: string,
  memberType: RoleMemberType,
): RoleMember | undefined {
  const wanted: RoleMemberIdentity = { id: memberId, type: memberType };
  return list.members.find((member) => isSameRoleMember(member, wanted));
}

/* -------------------------------------------------------------------------- */
/*  Colonnes (D28)                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Colonnes du kanban des roles (D28, `kanban.php` l.626-646) : les roles
 * DECLARES d'abord, dans l'ordre de `roles` de l'element, puis les roles
 * seulement PORTES, dans l'ordre des membres et de leur liste ; comparaison
 * exacte apres `trim`, sans doublon. Les porteurs d'une colonne suivent l'ordre
 * des membres. `memberIds` ne porte que des ids : c'est la forme du contrat
 * (§12.3), le type se retrouve dans `members`.
 */
export function roleColumnsFor(
  declared: readonly string[],
  members: readonly Pick<RoleMember, 'id' | 'roles'>[],
): RoleEntry[] {
  const declaredNames = uniqueRoleNames(declared);
  const names = [...declaredNames];
  for (const member of members) {
    for (const name of uniqueRoleNames(member.roles)) if (!names.includes(name)) names.push(name);
  }
  return names.map((name) => ({
    name,
    declared: declaredNames.includes(name),
    memberIds: members.filter((member) => uniqueRoleNames(member.roles).includes(name)).map((member) => member.id),
  }));
}

/** Noms des roles declares d'une liste servie : ceux dont la colonne existe meme sans porteur. */
export function declaredRoleNames(list: Pick<RoleListResult, 'roles'>): string[] {
  return list.roles.filter((entry) => entry.declared).map((entry) => entry.name);
}

/** Recalcule les colonnes a partir des membres : apres toute ecriture locale, c'est la seule verite. */
function withRecomputedColumns(list: RoleListResult, declared: readonly string[], members: RoleMember[]): RoleListResult {
  return { ...list, members, roles: roleColumnsFor(declared, members) };
}

/* -------------------------------------------------------------------------- */
/*  Cache optimiste et reponses du serveur                                     */
/* -------------------------------------------------------------------------- */

/**
 * Attribution OPTIMISTE d'un role a un membre : la liste du membre gagne le
 * role, et le role devient declare (le serveur fait `$addToSet roles`, D29).
 * Un membre inconnu de la liste ne change rien : le serveur repondra 404
 * `notLinked`, et le rollback n'aura rien a defaire.
 */
export function assignRoleLocally(list: RoleListResult, member: RoleMemberIdentity, role: string): RoleListResult {
  const name = cleanRoleName(role);
  if (name === '') return list;
  const members = list.members.map((entry) =>
    isSameRoleMember(entry, member) && !entry.roles.includes(name) ? { ...entry, roles: [...entry.roles, name] } : entry,
  );
  return withRecomputedColumns(list, [...declaredRoleNames(list), name], members);
}

/**
 * Retrait OPTIMISTE d'un role a un membre. Une colonne non declaree qui perd son
 * dernier porteur disparait, comme elle disparaitrait du prochain `role/list`.
 */
export function unassignRoleLocally(list: RoleListResult, member: RoleMemberIdentity, role: string): RoleListResult {
  const name = cleanRoleName(role);
  const members = list.members.map((entry) =>
    isSameRoleMember(entry, member) ? { ...entry, roles: entry.roles.filter((held) => cleanRoleName(held) !== name) } : entry,
  );
  return withRecomputedColumns(list, declaredRoleNames(list), members);
}

/** Creation OPTIMISTE d'une colonne : declaree, sans porteur ; deja presente, elle devient declaree. */
export function createRoleLocally(list: RoleListResult, role: string): RoleListResult {
  const name = cleanRoleName(role);
  if (name === '') return list;
  return withRecomputedColumns(list, [...declaredRoleNames(list), name], list.members);
}

/** Suppression OPTIMISTE d'une colonne : retiree de chaque porteur et des roles declares (D29). */
export function deleteRoleLocally(list: RoleListResult, role: string): RoleListResult {
  const name = cleanRoleName(role);
  const members = list.members.map((member) =>
    member.roles.some((entry) => cleanRoleName(entry) === name)
      ? { ...member, roles: member.roles.filter((entry) => cleanRoleName(entry) !== name) }
      : member,
  );
  const declared = declaredRoleNames(list).filter((entry) => entry !== name);
  return withRecomputedColumns(list, declared, members);
}

/**
 * Revision du tableau portee par la liste, AVANCEE a celle d'une reponse (une
 * revision ne redescend jamais). C'est elle que le polling compare a la
 * revision des activites `role.updated` pour ne pas relire ce que la liste
 * contient deja (`rolesRereadNeeded`) : chaque ecriture propre la pose.
 */
export function withRolesRev(list: RoleListResult, rev: number): RoleListResult {
  return rev > list.rev ? { ...list, rev } : list;
}

/**
 * Reponse d'une ecriture (`role/assign`, `role/unassign`) posee sur la liste :
 * la liste COMPLETE du membre fait autorite (D29), et la revision avance.
 */
export function applyRoleWrite(list: RoleListResult, result: RoleWriteResult): RoleListResult {
  const members = list.members.map((member) =>
    isSameRoleMember(member, result.member) ? { ...member, roles: [...result.member.roles] } : member,
  );
  return withRolesRev(withRecomputedColumns(list, declaredRoleNames(list), members), result.rev);
}

/** Nombre de porteurs d'une colonne : la capsule de son en-tete (§12.4). */
export function roleHolderCount(entry: Pick<RoleEntry, 'memberIds'>): number {
  return entry.memberIds.length;
}
