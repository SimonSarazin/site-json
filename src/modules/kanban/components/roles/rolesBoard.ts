/**
 * Kanban des roles d'un element Communecter (§12.4, D27-D30) — logique PURE de
 * la vue, testee dans `tests/unit/rolesBoardLogic.test.ts`.
 *
 * Tout ce qui se decide sans React vit ici : la recherche (nom ET role, dans
 * toutes les colonnes), les colonnes affichees, l'admissibilite d'un depot, la
 * place du fantome pendant le glisser, les messages annonces au lecteur
 * d'ecran et la validation du composeur. Les trois chemins d'ecriture lisent
 * la MEME liste servie et appliquent la meme regle « deja porte = refus »,
 * chacun par sa cle : `canReceive` (par id de membre) pour le depot au
 * pointeur, `memberHoldsRole` (par libelle, apres `trim`) pour les cases de la
 * boite « Rôles… », `checkRoleName` (doublon exact apres `trim`) pour le
 * composeur.
 *
 * La liste servie (`RoleListResult`) fait autorite : ce module ne recalcule
 * jamais les colonnes (`roleColumnsFor`, dans `lib/roles.ts`), il ne fait
 * que les LIRE et les filtrer.
 */
import { normalizeSearchText } from '@/modules/kanban/lib/boardFilter';
import { cleanRoleName, isValidRoleName, ROLE_NAME_MAX_LENGTH, roleNameLength } from '@/modules/kanban/lib/roles';
import type { RoleEntry, RoleListResult, RoleMember, RoleMemberType } from '@/modules/kanban/types';

/* -------------------------------------------------------------------------- */
/*  Identites                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Cle STABLE d'un membre : son type puis son id. Les porteurs d'une colonne
 * (`memberIds`) ne portent que des ids, mais une carte, une cle React ou un
 * identifiant dnd-kit doit distinguer un citoyen d'une organisation membre —
 * meme si leurs ids ne se croisent jamais en pratique.
 */
export function memberKey(member: Pick<RoleMember, 'id' | 'type'>): string {
  return `${member.type}:${member.id}`;
}

/* -------------------------------------------------------------------------- */
/*  Recherche                                                                 */
/* -------------------------------------------------------------------------- */

/** Aiguille de recherche : sans accents ni casse, blancs exterieurs ignores. */
export function searchNeedle(query: string): string {
  return normalizeSearchText(query.trim());
}

/**
 * Un membre correspond a la recherche par son NOM ou par l'un de ses ROLES :
 * taper « coord » montre les coordinateurs dans « Membres » ET dans la colonne
 * « Coordination » — le kanban de Communecter ne filtrait que ses deux premieres
 * colonnes, et laissait les colonnes de role pleines.
 */
export function memberMatches(member: Pick<RoleMember, 'name' | 'roles'>, needle: string): boolean {
  if (needle === '') return true;
  if (normalizeSearchText(member.name).includes(needle)) return true;
  return member.roles.some((role) => normalizeSearchText(role).includes(needle));
}

/* -------------------------------------------------------------------------- */
/*  Colonnes affichees                                                        */
/* -------------------------------------------------------------------------- */

export interface RoleColumnModel {
  role: RoleEntry;
  /** Porteurs AFFICHES (filtre applique), dans l'ordre des membres (D28). */
  holders: RoleMember[];
  /** Porteurs reels, filtre ou non : la capsule de l'en-tete compte ceux-la. */
  holderCount: number;
}

export interface RolesBoardModel {
  /** Cartes de « Membres » (filtre applique), dans l'ordre du serveur. */
  members: RoleMember[];
  /** Effectif reel, pour la capsule de « Membres ». */
  memberCount: number;
  columns: RoleColumnModel[];
  /** Une recherche restreint l'affichage : une colonne vide veut alors dire « rien ne correspond ». */
  filtering: boolean;
  /** Membres distincts qui correspondent a la recherche (annonce « N membres correspondent »). */
  matchCount: number;
}

/**
 * Le tableau tel qu'il s'affiche : « Membres » puis une colonne par role, dans
 * l'ORDRE DU SERVEUR (declares d'abord, puis portes — D28), chaque colonne
 * gardant ses porteurs dans l'ordre des membres. Un porteur dont la fiche
 * manque (course avec un depart) est ignore plutot que rendu comme un id.
 */
export function buildRolesBoard(list: Pick<RoleListResult, 'roles' | 'members'>, query: string): RolesBoardModel {
  const needle = searchNeedle(query);
  const byId = new Map(list.members.map((member) => [member.id, member]));
  const members = list.members.filter((member) => memberMatches(member, needle));
  const visibleIds = new Set(members.map((member) => member.id));
  const columns = list.roles.map((role) => {
    const holders = role.memberIds.flatMap((id) => {
      const member = byId.get(id);
      return member === undefined ? [] : [member];
    });
    return { role, holders: holders.filter((member) => visibleIds.has(member.id)), holderCount: holders.length };
  });
  return { members, memberCount: list.members.length, columns, filtering: needle !== '', matchCount: members.length };
}

/**
 * Colonnes de role RENDUES : celles que le poste ne masque pas (D34, DESIGN
 * §6.6). Une colonne masquee n'est pas rendue, donc jamais une cible de depot ;
 * la boite « Rôles… », elle, lit `list.roles` et propose toujours tous les
 * roles — masquer une colonne ne retire pas un role.
 */
export function visibleRoleColumns(columns: readonly RoleColumnModel[], hiddenRoles: readonly string[]): RoleColumnModel[] {
  if (hiddenRoles.length === 0) return [...columns];
  const hidden = new Set(hiddenRoles);
  return columns.filter((column) => !hidden.has(column.role.name));
}

/** « N membres, M roles » : les deux nombres de la phrase d'intro. */
export function rolesSummary(list: Pick<RoleListResult, 'roles' | 'members'>): { memberCount: number; roleCount: number } {
  return { memberCount: list.members.length, roleCount: list.roles.length };
}

/* -------------------------------------------------------------------------- */
/*  Glisser-deposer : donnees portees et decision du depot                    */
/* -------------------------------------------------------------------------- */

export interface MemberDragData {
  type: 'member';
  memberId: string;
  memberType: RoleMemberType;
}

export interface RoleDropData {
  type: 'role';
  role: string;
}

/** Zone de « Membres » : declaree DESACTIVEE, et dite pour ce qu'elle est — jamais un role au libelle vide. */
export interface MembersDropData {
  type: 'members';
}

/*
 * Les identifiants des deux familles sont prefixes : une carte membre et une
 * colonne de role cohabitent dans le meme `DndContext` et aucun id ne doit
 * pouvoir se confondre avec l'autre, quel que soit le libelle d'un role.
 */
export function memberDragId(member: Pick<RoleMember, 'id' | 'type'>): string {
  return `member:${memberKey(member)}`;
}

export function roleDropId(role: string): string {
  return `role:${role}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/* dnd-kit type `data.current` en `Record<string, any>` : ces gardes evitent tout `as`. */
export function isMemberDragData(value: unknown): value is MemberDragData {
  return (
    isRecord(value) &&
    value.type === 'member' &&
    typeof value.memberId === 'string' &&
    (value.memberType === 'citoyens' || value.memberType === 'organizations')
  );
}

export function isRoleDropData(value: unknown): value is RoleDropData {
  return isRecord(value) && value.type === 'role' && typeof value.role === 'string';
}

/** Une colonne de role accepte un membre qui ne la porte pas encore (D27 : glisser = copie, jamais deux fois). */
export function canReceive(role: Pick<RoleEntry, 'memberIds'>, memberId: string): boolean {
  return !role.memberIds.includes(memberId);
}

/** Ce qu'un lacher produirait sur la cible survolee. */
export type DropOutcome =
  | { kind: 'assign'; role: string }
  /** Le membre porte deja ce role : rien n'est ecrit, et on le dit (le kanban de Communecter aussi). */
  | { kind: 'alreadyHeld'; role: string }
  /** Hors d'une colonne de role (« Membres », ou le vide) : rien ne change. */
  | { kind: 'none' };

/**
 * Decision d'un depot, UNIQUE pour l'apercu (fantome), le lacher et les
 * annonces : une colonne disparue entre-temps (suppression distante) ne
 * recoit rien.
 */
export function resolveDrop(overData: unknown, roles: readonly RoleEntry[], memberId: string): DropOutcome {
  if (!isRoleDropData(overData)) return { kind: 'none' };
  const role = roles.find((entry) => entry.name === overData.role);
  if (role === undefined) return { kind: 'none' };
  return canReceive(role, memberId) ? { kind: 'assign', role: role.name } : { kind: 'alreadyHeld', role: role.name };
}

/**
 * Place du FANTOME dans une colonne de role : celle que prendrait le membre
 * parmi les porteurs affiches, dans l'ordre des membres (D28) — pas sous le
 * pointeur, ou la carte sauterait au lacher. Un membre inconnu de l'ordre va
 * en fin de colonne.
 */
export function ghostIndex(holderIds: readonly string[], memberOrder: readonly string[], memberId: string): number {
  const rank = memberOrder.indexOf(memberId);
  if (rank === -1) return holderIds.length;
  const index = holderIds.findIndex((id) => memberOrder.indexOf(id) > rank);
  return index === -1 ? holderIds.length : index;
}

/* -------------------------------------------------------------------------- */
/*  Annonces du glisser (cles i18n ; la vue traduit)                          */
/* -------------------------------------------------------------------------- */

export interface RolesMessage {
  key: string;
  values: Readonly<Record<string, string | number>>;
}

export function dragStartMessage(name: string): RolesMessage {
  return { key: 'views.roles.dragStart', values: { name } };
}

/** Survol : ce que le lacher ferait ; `undefined` hors de toute colonne (silence plutot qu'un bruit a chaque sortie). */
export function dragOverMessage(name: string, outcome: DropOutcome): RolesMessage | undefined {
  if (outcome.kind === 'assign') return { key: 'views.roles.dragOver', values: { name, role: outcome.role } };
  if (outcome.kind === 'alreadyHeld') return { key: 'views.roles.alreadyAssigned', values: { name, role: outcome.role } };
  return undefined;
}

/** Lacher : le role attribue, le refus (deja porte) ou le lacher dans le vide. */
export function dragEndMessage(name: string, outcome: DropOutcome): RolesMessage {
  if (outcome.kind === 'assign') return { key: 'views.roles.assigned', values: { name, role: outcome.role } };
  if (outcome.kind === 'alreadyHeld') return { key: 'views.roles.alreadyAssigned', values: { name, role: outcome.role } };
  return { key: 'views.roles.dragOutside', values: { name } };
}

export function dragCancelMessage(name: string): RolesMessage {
  return { key: 'views.roles.dragCancelled', values: { name } };
}

export type RoleWriteAction = 'assign' | 'unassign';

/**
 * Refus du serveur apres une ecriture annoncee en OPTIMISTE (boite « Rôles… »,
 * depot, retrait) : la region vivante redit l'etat vrai — le cache vient d'etre
 * repose, la case ou la carte avec lui — et la raison, deja traduite
 * (`kanbanErrorText`). Sans ce second message, la ligne affirmerait une
 * attribution qui n'a pas eu lieu.
 */
export function roleWriteRefusedMessage(action: RoleWriteAction, name: string, role: string, reason: string): RolesMessage {
  return { key: action === 'assign' ? 'views.roles.assignRefused' : 'views.roles.removeRefused', values: { name, role, reason } };
}

/* -------------------------------------------------------------------------- */
/*  Composeur « Ajouter un rôle »                                             */
/* -------------------------------------------------------------------------- */

/** Motif de refus d'un libelle ; chacun a son message `views.roles.errors.<motif>`. */
export type RoleNameProblem = 'roleRequired' | 'roleTooLong' | 'roleInvalid' | 'roleExists';

export type RoleNameCheck = { ok: true; name: string } | { ok: false; problem: RoleNameProblem; name: string };

/**
 * Validation du composeur, AVANT l'appel : la meme regle que le serveur (D29,
 * `isValidRoleName`), plus le doublon — une colonne existe deja sous ce nom,
 * comparaison exacte apres `trim` comme Communecter ; le serveur accepterait
 * (`created:false`) mais la personne attendait une nouvelle colonne.
 */
export function checkRoleName(value: string, existing: readonly string[]): RoleNameCheck {
  const name = cleanRoleName(value);
  if (name === '') return { ok: false, problem: 'roleRequired', name };
  // Points de code, pas unites UTF-16 : le serveur compte en `mb_strlen`, un
  // libelle de 60 emojis doit passer ici comme la-bas.
  if (roleNameLength(name) > ROLE_NAME_MAX_LENGTH) return { ok: false, problem: 'roleTooLong', name };
  if (!isValidRoleName(name)) return { ok: false, problem: 'roleInvalid', name };
  if (existing.some((entry) => cleanRoleName(entry) === name)) return { ok: false, problem: 'roleExists', name };
  return { ok: true, name };
}

/** Le membre porte-t-il ce role ? Comparaison exacte apres `trim` (D28). */
export function memberHoldsRole(member: Pick<RoleMember, 'roles'>, role: string): boolean {
  const name = cleanRoleName(role);
  return member.roles.some((entry) => cleanRoleName(entry) === name);
}
