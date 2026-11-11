/**
 * Contrat de donnees de l'API kanban (blueprint §2, §3, §11 et §13).
 *
 * Deux conventions structurent tout ce fichier :
 *  - les identifiants sont des `string` (l'`_id` Mongo est serialise nu, jamais
 *    en `{$oid}`) ;
 *  - les dates sont des entiers en SECONDES (`time()` PHP), jamais des
 *    `MongoDate` ni des ISO — cf. blueprint D2.
 *
 * Les gardes de type (`isBoard`, `isCard`, …) sont la contrepartie de la regle
 * « type guards plutot que `as` » : le transport les exige pour rendre une
 * reponse, si bien qu'un backend qui devie du contrat echoue bruyamment au
 * lieu de propager un objet incomplet dans l'interface.
 *
 * DEUX SOURCES depuis le §11 : un board `kanban` (collections `kanban*`) ou un
 * board-lien `communecter` (vue sur les `actions` d'un projet — ou, depuis le
 * §12, d'une ORGANISATION : `parentType` dit lequel). Les champs apparus avec
 * les §11 et §12 sont OPTIONNELS sur le fil — un backend anterieur ne les
 * envoie pas, et un board sans `source` est un board `kanban` (§11.2, aucune
 * migration). Les gardes les TOLERENT absents mais restent STRICTES sur leur
 * forme quand ils sont la : un champ present et faux reste un bug serveur.
 *
 * Les ROLES d'un element Communecter (§12, D27-D30) suivent la meme regle :
 * les reponses de `role/*` sont exigees completes (routes nouvelles, aucun
 * module anterieur ne les sert), seule la capacite `canManageRoles` est toleree
 * absente, completee a `false` par `completeCapabilities`.
 */

export type Role = 'owner' | 'editor' | 'viewer';
export type Priority = 'low' | 'medium' | 'high' | 'urgent';
/**
 * Avancement du TRAVAIL, distinct de la colonne qui dit ou en est le FLUX
 * (blueprint §2.3). Le serveur force `complete` a l'entree dans une colonne de
 * cloture et ramene a `on_track` a la sortie : le front ne rededuit jamais
 * cette regle, il affiche ce que le backend a tranche. Sur un board-lien, le
 * statut est DERIVE de la colonne (§11.4) et n'est pas editable.
 */
export type CardStatus = 'not_started' | 'in_research' | 'on_track' | 'complete';
export type BoardStatus = 'active' | 'archived';
export type BoardVisibility = 'private' | 'parentCommunity';
export type ParentType = 'organizations' | 'projects';

/** Provenance des cartes d'un tableau (§11) : collections kanban ou actions Communecter. */
export type BoardSource = 'kanban' | 'communecter';

/**
 * Colonnes virtuelles d'un board-lien (§11.3) : leur `_id` EST leur `titleKey`,
 * ce sont les six statuts de Kanban gestion (`Action::get_action_status`).
 */
export type CommunecterColumnId = 'todo' | 'next' | 'tracking' | 'totest' | 'discuter' | 'done';

/** `close` et non `closed` : c'est la valeur stockee par Kanban gestion. */
export type MilestoneStatus = 'open' | 'close';

export const ROLES: readonly Role[] = ['owner', 'editor', 'viewer'];
export const PRIORITIES: readonly Priority[] = ['low', 'medium', 'high', 'urgent'];
/** Dans l'ordre d'avancement : c'est aussi l'ordre d'affichage des reparts. */
export const CARD_STATUSES: readonly CardStatus[] = [
  'not_started',
  'in_research',
  'on_track',
  'complete',
];
export const BOARD_SOURCES: readonly BoardSource[] = ['kanban', 'communecter'];
/** Ordre par defaut des colonnes d'un board-lien : celui des en-tetes de gestion (§11.3). */
export const COMMUNECTER_COLUMN_IDS: readonly CommunecterColumnId[] = [
  'todo',
  'next',
  'tracking',
  'totest',
  'discuter',
  'done',
];
export const MILESTONE_STATUSES: readonly MilestoneStatus[] = ['open', 'close'];

/** Profil citoyen tel que PROJETE par le backend (jamais le document brut). */
export interface UserProfile {
  _id: string;
  name: string;
  username: string;
  slug: string;
  /**
   * Chemin TEL QUE STOCKE par Communecter, souvent relatif (`/upload/...`) :
   * l'afficher passe par `resolveMediaUrl`, sans quoi il se resout sur
   * l'origine du front et l'image casse.
   */
  profilThumbImageUrl: string | null;
}

export type ChecklistItem = {
  id: string;
  label: string;
  done: boolean;
};

/**
 * Lien porte par une carte — objet de valeur imbrique, d'ou `id` et non `_id`.
 *
 * SECURITE : `url` est garantie `http(s)` PAR LE BACKEND (`KanbanInput::sanitizeUrl`),
 * qui refuse au lieu de nettoyer. Le front ne re-valide pas le schema a
 * l'affichage, il se contente de ne jamais construire de `href` autrement.
 */
export interface CardLink {
  id: string;
  url: string;
  /** Jamais vide : le backend retombe sur l'hote de l'URL. */
  label: string;
}

export interface BoardLabel {
  id: string;
  name: string;
  color: string;
}

export interface BoardCounts {
  columns: number;
  cards: number;
  done: number;
}

/** Entree de `board.members[]` : le role explicite, sans le profil. */
export interface BoardMemberEntry {
  userId: string;
  role: Role;
  addedBy: string;
  addedAt: number;
}

/**
 * Board tel que renvoye par `board/list`.
 *
 * `members[]` n'est garanti que par `board/get` : la liste n'a besoin que des
 * compteurs et des metadonnees, d'ou ce type plus etroit.
 */
export interface BoardSummary {
  _id: string;
  title: string;
  description: string;
  status: BoardStatus;
  color: string | null;
  startDate: number | null;
  endDate: number | null;
  parentType: ParentType | null;
  parentId: string | null;
  visibility: BoardVisibility;
  allowExternalMembers: boolean;
  memberIds: string[];
  labels: BoardLabel[];
  counts: BoardCounts;
  /** Compteur d'ecritures : socle du polling delta (`board/sync`). */
  rev: number;
  creator: string;
  created: number;
  updated: number;
  /** Absent = `kanban` : lire par `boardSourceOf`, jamais directement. */
  source?: BoardSource;
  /**
   * Image de couverture, chemin TEL QUE STOCKE (miroir du projet ou de
   * l'organisation pour un board-lien) : a resoudre par `resolveMediaUrl`
   * contre l'origine de l'API.
   */
  cover?: string | null;
  /** Profil projete de `creator` ; `null` quand le compte a disparu. */
  creatorProfile?: UserProfile | null;
  /** Role EFFECTIF de l'appelant (`board/list`) — jamais une deduction du front. */
  role?: Role | null;
  /** Au plus quatre profils, pour la pile d'avatars d'une tuile. */
  memberPreview?: UserProfile[];
  memberCount?: number;
  /**
   * Board-lien : QUI a relie le projet a un tableau kanban, et QUAND (§11.9).
   * `creator` / `created` y sont ceux du PROJET (« Cree par » de la maquette),
   * miroir comme le titre : ces deux champs-ci disent ce que le lien ajoute.
   * `linkedBy` vaut `""` si le lien n'a pas d'auteur connu.
   */
  linkedBy?: string;
  linkedAt?: number;
}

export interface Board extends BoardSummary {
  /** Toujours vide sur un board-lien : ses droits viennent de Communecter (§11.5). */
  members: BoardMemberEntry[];
}

export interface Column {
  _id: string;
  boardId: string;
  title: string;
  /**
   * Cle de traduction tant que la colonne garde son libelle par defaut :
   * `todo` | `doing` | `done` (board kanban), ou l'un des six statuts d'un
   * board-lien. `null` des qu'un libelle humain prime.
   */
  titleKey: string | null;
  rank: number;
  color: string | null;
  wipLimit: number | null;
  isDoneColumn: boolean;
  cardCount: number;
  creator: string;
  created: number;
  updated: number;
  /**
   * Colonne VIRTUELLE d'un board-lien (§11.3) : un statut de Kanban gestion,
   * stocke dans aucune collection. On ne la cree, ne la renomme ni ne la
   * supprime ; seul son ORDRE se change (`column/move`, owner).
   */
  virtual?: boolean;
}

/** Copie du jalon portee par une action (`actions.milestone`, §11.4). */
export interface CardMilestone {
  milestoneId: string;
  name: string;
  status: MilestoneStatus;
}

export interface Card {
  _id: string;
  boardId: string;
  columnId: string;
  rank: number;
  title: string;
  description: string;
  /** `null` = « aucune » : le cas MAJORITAIRE des actions Communecter (§11.4). */
  priority: Priority | null;
  assignees: string[];
  labelIds: string[];
  /**
   * VIDE quand `checklistTruncated` est vrai : ce n'est alors pas la liste de
   * la carte. Les compteurs ci-dessous restent exacts dans tous les cas.
   */
  checklist: ChecklistItem[];
  checklistDone: number;
  checklistTotal: number;
  /**
   * Board-lien (§11.9 E29) : `board/get` sert les checklists dans un BUDGET
   * d'octets, dans l'ordre des cartes. Au-dela, la carte arrive `checklist: []`
   * et `checklistTruncated: true` — la fiche lit alors la carte complete par
   * `card/get` avant d'en faire un brouillon. Absent (ou `false`) = liste
   * complete : c'est le cas de `card/get`, des reponses d'ecriture et de tout
   * board kanban.
   */
  checklistTruncated?: boolean;
  status: CardStatus;
  links: CardLink[];
  /**
   * Derives du backend, jamais recalcules ici : la vue board charge des
   * centaines de cartes et n'a ni les URLs ni le fil de discussion sous la
   * main. Les desynchroniser, c'est afficher « 2 liens » sur une carte qui
   * n'en a plus qu'un.
   */
  linkCount: number;
  commentCount: number;
  dueDate: number | null;
  completedAt: number | null;
  creator: string;
  created: number;
  updated: number;
  /** Etiquettes LIBRES d'une action, pseudo-tags de statut retires (§11.4). */
  tags?: string[];
  startDate?: number | null;
  milestone?: CardMilestone | null;
  /** Montant ; `1` est le defaut serveur de Communecter. `null` = non renseigne. */
  credits?: number | null;
  /** Temps passe, en MINUTES. `null` = non renseigne. */
  timeSpent?: number | null;
  /** Commentaires que l'appelant n'a pas encore vus (`views.<userId>`). */
  unseenComments?: number;
  /** Toujours `false` sur un instantane : les cartes archivees ne sont pas chargees. */
  archived?: boolean;
}

/**
 * Message d'un fil de carte (`kanbanCardComments`, ou `comments` pour une
 * action Communecter).
 *
 * `author` est le profil PROJETE de l'auteur, joint par le backend : sans lui,
 * chaque ligne du fil declencherait une requete de profil. Il vaut `null`
 * quand le compte a disparu — le fil reste lisible, signe « auteur inconnu ».
 */
export interface CardComment {
  _id: string;
  boardId: string;
  cardId: string;
  authorId: string;
  text: string;
  created: number;
  updated: number;
  author: UserProfile | null;
}

/**
 * Provenance fine d'un role HERITE du collectif parent.
 *
 * Elle est portee par un champ SEPARE de `origin` : l'interface a besoin de
 * savoir qu'un droit vient du parent (`origin: 'parent'`, ligne non modifiable)
 * sans que la nuance admin/membre ne vienne polluer cette question binaire.
 * `null` des que le role est explicite sur le tableau.
 */
export type InheritedFrom = 'parentAdmin' | 'parentMember';

/** Membre vu par `member/list` : role effectif + provenance + profil projete. */
export interface Member {
  userId: string;
  role: Role;
  /** `board` = role explicite sur le tableau, `parent` = role herite. */
  origin: 'board' | 'parent';
  /** Detail de l'heritage ; toujours `null` quand `origin === 'board'`. */
  inheritedFrom: InheritedFrom | null;
  /** RG-13 : le dernier owner explicite n'est pas retirable. */
  removable: boolean;
  profile: UserProfile | null;
}

/** Jalon d'un PROJET Communecter (`projects.oceco.milestones[]`, §11.6) — une organisation n'en a jamais (D22). */
export interface Milestone {
  /** Chaine de 17 caracteres facon Meteor : la cle d'ecriture, jamais l'index. */
  milestoneId: string;
  name: string;
  /** `null` apres un effacement par `milestone/update`, ou sur un jalon sans description. */
  description: string | null;
  startDate: number | null;
  endDate: number | null;
  status: MilestoneStatus;
}

/**
 * Droits CALCULES PAR LE SERVEUR (blueprint D10), sous leur forme COMPLETE.
 *
 * Le front ne deduit jamais un droit d'un role : il grise l'interface a partir
 * de ces booleens, qui integrent deja l'heritage depuis le parent et le
 * verrouillage d'un board archive. Les capacites du §11.5 sont completees par
 * `completeCapabilities` quand un backend anterieur ne les envoie pas — a
 * partir d'AUTRES capacites serveur, jamais du role.
 */
export interface Capabilities {
  role: Role | null;
  canViewBoard: boolean;
  canEditCards: boolean;
  canManageColumns: boolean;
  canManageMembers: boolean;
  canEditBoard: boolean;
  canArchiveBoard: boolean;
  canDeleteBoard: boolean;
  /** Rattacher le tableau a une organisation / un projet. */
  canAttachBoard: boolean;
  /** Le detacher de son parent (il redevient prive). */
  canDetachBoard: boolean;
  /** Quitter le tableau soi-meme (RG-13 : pas le dernier owner explicite). */
  canLeaveBoard: boolean;
  /** `true` si le role vient d'une entree `members[]`, pas d'un heritage. */
  isExplicitOwner: boolean;
  /** Miroir de `board.status === 'archived'` : la source du verrouillage. */
  archived: boolean;
  /** Reordonner les colonnes (board-lien : owner, ecrit `kanbanColumnOrder`). */
  canReorderColumns: boolean;
  /** Renommer une colonne (board-lien : jamais, le libelle vit sur l'organisation). */
  canRenameColumns: boolean;
  /** Archiver une carte (`card/archive`). */
  canArchiveCards: boolean;
  /** Creer, renommer, clore ou rouvrir un jalon. */
  canManageMilestones: boolean;
  /** Modifier montant et temps passe d'une carte. */
  canEditCredits: boolean;
  /**
   * Attribuer, retirer, creer ou supprimer un ROLE de l'element Communecter
   * (§12, D27) : administrateur de l'element, sur un board-lien seulement —
   * `false` sur un board kanban, qui n'a pas de roles de lien.
   */
  canManageRoles: boolean;
  source: BoardSource;
}

/** Capacites apparues aux §11.5 et §12.3 : un backend anterieur ne les envoie pas. */
export type CapabilityV2Key =
  | 'canReorderColumns'
  | 'canRenameColumns'
  | 'canArchiveCards'
  | 'canManageMilestones'
  | 'canEditCredits'
  | 'canManageRoles'
  | 'source';

/** Capacites telles que recues sur le fil, avant `completeCapabilities`. */
export type CapabilitiesPayload = Omit<Capabilities, CapabilityV2Key> &
  Partial<Pick<Capabilities, CapabilityV2Key>>;

/** Instantane d'un board, NORMALISE (capacites completes, jalons toujours presents). */
export interface BoardSnapshot {
  board: Board;
  columns: Column[];
  cards: Card[];
  members: Member[];
  capabilities: Capabilities;
  /** Toujours vide sur un board `kanban`. */
  milestones: Milestone[];
  /**
   * Langue dans laquelle `board/get` a servi les libelles des colonnes d'un
   * board-lien (`oceco.kanbanColumns.<lang>`, §11.3) — posee par le CLIENT a la
   * reception, jamais par le serveur ; absente = inconnue. Elle permet de
   * recharger un instantane servi dans une autre langue que celle de
   * l'interface (`labelsLanguageStale`), la langue n'etant pas dans la cle.
   */
  servedLanguage?: 'fr' | 'en';
}

/** Charge utile de `board/get` telle que recue : le seul endpoint de chargement d'un board. */
export interface BoardSnapshotPayload extends Omit<BoardSnapshot, 'capabilities' | 'milestones' | 'servedLanguage'> {
  capabilities: CapabilitiesPayload;
  /** Absent d'un board `kanban` servi par un module anterieur au §11. */
  milestones?: Milestone[];
}

export const ACTIVITY_VERBS = [
  'board.created',
  'board.updated',
  'board.archived',
  'board.attached',
  'board.detached',
  'member.added',
  'member.role',
  'member.removed',
  'column.created',
  'column.updated',
  'column.moved',
  'column.deleted',
  'card.created',
  'card.updated',
  'card.moved',
  // `card/archive` (§11.6) est journalise en `card.deleted` avec
  // `payload.archived: true` : le rejeu est le meme (la carte quitte le
  // tableau), seul le libelle du fil d'activite change (`activityLabelKey`).
  'card.deleted',
  // Ecriture d'un role de l'element Communecter (§12, D30) : `cardId` et
  // `columnId` nuls, payload `{member:{id,type,roles}}`, `{role, created:true}`
  // ou `{role, deleted:true, removedFrom}`. Jamais rejoue finement : le front
  // recharge `role/list` (cf. `rolesTouched`).
  'role.updated',
] as const;

export type ActivityVerb = (typeof ACTIVITY_VERBS)[number];

/**
 * Ligne du journal `kanbanActivities`, consommee par le polling delta.
 *
 * `payload` est volontairement ouvert, mais le contrat impose l'essentiel :
 * `card.created` / `card.updated` / `card.moved` transportent la CARTE
 * serialisee (`{card}`), `column.created` / `column.updated` / `column.moved`
 * la COLONNE (`{column}`). C'est ce qui rend le rejeu incremental — et
 * idempotent : reappliquer deux fois la meme ligne donne le meme etat. Les
 * verbes qui ne portent qu'une intention (`member.*`, `board.updated`) font
 * demander un rechargement complet au reducteur `boardSync`.
 */
export interface Activity {
  _id: string;
  boardId: string;
  cardId: string | null;
  columnId: string | null;
  actorId: string;
  verb: ActivityVerb;
  payload: Record<string, unknown>;
  rev: number;
  at: number;
}

export type SyncResult =
  | { rev: number; full: true }
  | { rev: number; full: false; activities: Activity[] };

/** Renumerotation decidee par le serveur (blueprint §5) : elle fait autorite. */
export interface RankUpdate {
  id: string;
  rank: number;
}

export interface WipWarning {
  columnId: string;
  limit: number;
  count: number;
}

export interface BoardWithColumns {
  board: Board;
  columns: Column[];
}

/**
 * Reponse de `board/create`. `created` n'est porte que par un board-lien :
 * la creation est IDEMPOTENTE (§11.6), `false` = le lien existait deja.
 */
export interface BoardCreateResult extends BoardWithColumns {
  created?: boolean;
}

export interface ColumnMoveResult {
  column: Column;
  renumbered?: RankUpdate[];
}

export interface CardMoveResult {
  card: Card;
  renumbered?: RankUpdate[];
  /** La limite WIP AVERTIT, elle ne bloque pas : c'est un signal d'animation. */
  wipWarning?: WipWarning;
}

/** Reponse de `card/archive` (§11.6, deux sources). */
export interface CardArchiveResult {
  archived: true;
}

export interface CommentListResult {
  /** Du plus ancien au plus recent : un fil se lit dans l'ordre. */
  comments: CardComment[];
  /** Total SERVEUR, potentiellement superieur a `comments.length` (pagination). */
  total: number;
}

/**
 * Reponse de `comment/add` / `comment/delete`.
 *
 * `commentCount` est la valeur d'autorite recalculee par le serveur : le front
 * la pose telle quelle sur la carte du board plutot que d'incrementer son
 * propre compteur, qui derive des qu'un autre onglet a commente entre-temps.
 */
export interface CommentAddResult {
  comment: CardComment;
  commentCount: number;
}

export interface CommentDeleteResult {
  deleted: true;
  commentCount: number;
}

export interface MilestoneListResult {
  milestones: Milestone[];
}

/* -------------------------------------------------------------------------- */
/*  Roles d'un element Communecter (§12, D27-D30)                              */
/* -------------------------------------------------------------------------- */

/** Un membre d'element peut etre un citoyen ou une organisation membre (D28). */
export type RoleMemberType = 'citoyens' | 'organizations';

export const ROLE_MEMBER_TYPES: readonly RoleMemberType[] = ['citoyens', 'organizations'];

/**
 * Colonne du kanban des roles : un libelle, DECLARE dans `roles` de l'element
 * ou seulement PORTE par des membres, et ses porteurs dans l'ordre des membres.
 */
export interface RoleEntry {
  name: string;
  declared: boolean;
  memberIds: string[];
}

/** Membre lie a l'element (`links.members` / `links.contributors`), avec SES roles lus cote membre (D28). */
export interface RoleMember {
  id: string;
  type: RoleMemberType;
  name: string;
  slug: string;
  /** `profilThumbImageUrl`, sinon `profilImageUrl`, sinon `null` — chemin tel que stocke. */
  image: string | null;
  /** `isAdmin` sans `isAdminPending` : le drapeau, pas un role. */
  isAdmin: boolean;
  /** `toBeValidated` ou `isInviting` : visible et affectable, mais marque (E33). */
  pending: boolean;
  roles: string[];
}

export interface RoleListResult {
  roles: RoleEntry[];
  members: RoleMember[];
  canManageRoles: boolean;
  rev: number;
}

/** Ce que `role/assign` et `role/unassign` renvoient du membre : sa liste complete reecrite (D29). */
export interface RoleMemberRef {
  id: string;
  type: RoleMemberType;
  roles: string[];
}

export interface RoleWriteResult {
  member: RoleMemberRef;
  /** `false` = rien d'ecrit (role deja porte, ou deja absent) : l'appel est idempotent. */
  changed: boolean;
  rev: number;
}

export interface RoleCreateResult {
  role: string;
  /** `false` = deja declare, rien d'ecrit. */
  created: boolean;
  rev: number;
}

export interface RoleDeleteResult {
  role: string;
  /** Nombre de porteurs auxquels le role a ete retire. */
  removedFrom: number;
  rev: number;
}

/* -------------------------------------------------------------------------- */
/*  Gardes de type                                                            */
/* -------------------------------------------------------------------------- */

/** Objet simple (ni `null`, ni tableau) : la garde de base du module, partagée (bonnes pratiques §11). */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

function isNullable<T>(guard: (value: unknown) => value is T) {
  return (value: unknown): value is T | null => value === null || guard(value);
}

/**
 * Champ OPTIONNEL : absent passe, present doit etre conforme. C'est la regle
 * des champs du §11 — un backend anterieur ne les envoie pas, mais un backend
 * qui les envoie mal reste refuse.
 */
function isOptional<T>(guard: (value: unknown) => value is T) {
  return (value: unknown): value is T | undefined => value === undefined || guard(value);
}

function isArrayOf<T>(guard: (value: unknown) => value is T) {
  return (value: unknown): value is T[] => Array.isArray(value) && value.every(guard);
}

/**
 * Garde d'une valeur parmi une liste FERMEE de chaines. Exportee pour que les
 * autres modules (colonnes virtuelles, raisons d'erreur…) ne la recopient pas :
 * c'est ici, une seule fois, que vit l'elargissement `readonly T[]` ->
 * `readonly string[]` que `includes` exige.
 */
export function isOneOf<T extends string>(allowed: readonly T[]) {
  return (value: unknown): value is T =>
    typeof value === 'string' && (allowed as readonly string[]).includes(value);
}

const isStringArray = isArrayOf(isString);
const isNullableString = isNullable(isString);
const isNullableNumber = isNullable(isNumber);
const isRole = isOneOf(ROLES);
const isPriority = isOneOf(PRIORITIES);
const isCardStatus = isOneOf(CARD_STATUSES);
const isBoardSource = isOneOf(BOARD_SOURCES);
const isMilestoneStatus = isOneOf(MILESTONE_STATUSES);
const isParentType = isOneOf<ParentType>(['organizations', 'projects']);
const isInheritedFrom = isOneOf<InheritedFrom>(['parentAdmin', 'parentMember']);
const isRoleMemberType = isOneOf(ROLE_MEMBER_TYPES);

export function isUserProfile(value: unknown): value is UserProfile {
  return (
    isRecord(value) &&
    isString(value._id) &&
    isString(value.name) &&
    isString(value.username) &&
    isString(value.slug) &&
    isNullableString(value.profilThumbImageUrl)
  );
}

export function isChecklistItem(value: unknown): value is ChecklistItem {
  return isRecord(value) && isString(value.id) && isString(value.label) && isBoolean(value.done);
}

export function isCardLink(value: unknown): value is CardLink {
  return isRecord(value) && isString(value.id) && isString(value.url) && isString(value.label);
}

export function isBoardLabel(value: unknown): value is BoardLabel {
  return isRecord(value) && isString(value.id) && isString(value.name) && isString(value.color);
}

function isBoardMemberEntry(value: unknown): value is BoardMemberEntry {
  return (
    isRecord(value) &&
    isString(value.userId) &&
    isRole(value.role) &&
    isString(value.addedBy) &&
    isNumber(value.addedAt)
  );
}

export function isBoardSummary(value: unknown): value is BoardSummary {
  return (
    isRecord(value) &&
    isString(value._id) &&
    isString(value.title) &&
    isString(value.description) &&
    isOneOf<BoardStatus>(['active', 'archived'])(value.status) &&
    isNullableString(value.color) &&
    isNullableNumber(value.startDate) &&
    isNullableNumber(value.endDate) &&
    isNullable(isParentType)(value.parentType) &&
    isNullableString(value.parentId) &&
    isOneOf<BoardVisibility>(['private', 'parentCommunity'])(value.visibility) &&
    isBoolean(value.allowExternalMembers) &&
    isStringArray(value.memberIds) &&
    isArrayOf(isBoardLabel)(value.labels) &&
    isRecord(value.counts) &&
    isNumber(value.counts.columns) &&
    isNumber(value.counts.cards) &&
    isNumber(value.counts.done) &&
    isNumber(value.rev) &&
    isString(value.creator) &&
    isNumber(value.created) &&
    isNumber(value.updated) &&
    // Champs du §11.6 : toleres absents (module anterieur), stricts presents.
    isOptional(isBoardSource)(value.source) &&
    isOptional(isNullableString)(value.cover) &&
    isOptional(isNullable(isUserProfile))(value.creatorProfile) &&
    isOptional(isNullable(isRole))(value.role) &&
    isOptional(isArrayOf(isUserProfile))(value.memberPreview) &&
    isOptional(isNumber)(value.memberCount) &&
    isOptional(isString)(value.linkedBy) &&
    isOptional(isNumber)(value.linkedAt)
  );
}

export function isBoard(value: unknown): value is Board {
  return isRecord(value) && isBoardSummary(value) && isArrayOf(isBoardMemberEntry)(value.members);
}

export function isColumn(value: unknown): value is Column {
  return (
    isRecord(value) &&
    isString(value._id) &&
    isString(value.boardId) &&
    isString(value.title) &&
    isNullableString(value.titleKey) &&
    isNumber(value.rank) &&
    isNullableString(value.color) &&
    isNullableNumber(value.wipLimit) &&
    isBoolean(value.isDoneColumn) &&
    isNumber(value.cardCount) &&
    isString(value.creator) &&
    isNumber(value.created) &&
    isNumber(value.updated) &&
    isOptional(isBoolean)(value.virtual)
  );
}

export function isCardMilestone(value: unknown): value is CardMilestone {
  return (
    isRecord(value) &&
    isString(value.milestoneId) &&
    isString(value.name) &&
    isMilestoneStatus(value.status)
  );
}

export function isCard(value: unknown): value is Card {
  return (
    isRecord(value) &&
    isString(value._id) &&
    isString(value.boardId) &&
    isString(value.columnId) &&
    isNumber(value.rank) &&
    isString(value.title) &&
    isString(value.description) &&
    // `null` admis (« aucune », §11.4) ; une valeur hors enumeration reste
    // refusee : elle finirait dans un `Record<Priority, …>` cote interface.
    isNullable(isPriority)(value.priority) &&
    isStringArray(value.assignees) &&
    isStringArray(value.labelIds) &&
    isArrayOf(isChecklistItem)(value.checklist) &&
    isNumber(value.checklistDone) &&
    isNumber(value.checklistTotal) &&
    // EXIGES, pas optionnels : un `status` absent vaudrait `undefined` dans la
    // pastille haute de la carte, et un `commentCount` absent afficherait
    // « NaN commentaires ». On refuse la reponse au lieu de l'habiller.
    isCardStatus(value.status) &&
    isArrayOf(isCardLink)(value.links) &&
    isNumber(value.linkCount) &&
    isNumber(value.commentCount) &&
    isNullableNumber(value.dueDate) &&
    isNullableNumber(value.completedAt) &&
    isString(value.creator) &&
    isNumber(value.created) &&
    isNumber(value.updated) &&
    // Champs du §11.4, propres aux actions Communecter.
    isOptional(isStringArray)(value.tags) &&
    isOptional(isNullableNumber)(value.startDate) &&
    isOptional(isNullable(isCardMilestone))(value.milestone) &&
    isOptional(isNullableNumber)(value.credits) &&
    isOptional(isNullableNumber)(value.timeSpent) &&
    isOptional(isNumber)(value.unseenComments) &&
    isOptional(isBoolean)(value.archived) &&
    // Tolere ABSENT (module anterieur au budget, board kanban, `card/get`) :
    // la liste est alors complete. Present, c'est un booleen ou rien.
    isOptional(isBoolean)(value.checklistTruncated)
  );
}

export function isCardComment(value: unknown): value is CardComment {
  return (
    isRecord(value) &&
    isString(value._id) &&
    isString(value.boardId) &&
    isString(value.cardId) &&
    isString(value.authorId) &&
    isString(value.text) &&
    isNumber(value.created) &&
    isNumber(value.updated) &&
    // Champ EXIGE, `null` compris : un `undefined` ferait afficher une ligne
    // signee « undefined » au lieu de l'auteur inconnu assume.
    isNullable(isUserProfile)(value.author)
  );
}

export function isMember(value: unknown): value is Member {
  return (
    isRecord(value) &&
    isString(value.userId) &&
    isRole(value.role) &&
    isOneOf<'board' | 'parent'>(['board', 'parent'])(value.origin) &&
    // Champ EXIGE, `null` compris : un `undefined` signalerait un backend qui
    // ne distingue pas encore l'heritage, et l'interface afficherait alors une
    // ligne « heritee » sans savoir de quoi.
    isNullable(isInheritedFrom)(value.inheritedFrom) &&
    isBoolean(value.removable) &&
    isNullable(isUserProfile)(value.profile)
  );
}

export function isMilestone(value: unknown): value is Milestone {
  return (
    isRecord(value) &&
    isString(value.milestoneId) &&
    isString(value.name) &&
    // `null` admis : `milestone/update` efface la description par `null` (doc 41), et un
    // jalon pose par Kanban gestion peut n'en avoir aucune. Refuser la reponse entiere pour
    // ce seul champ priverait l'ecran de tout le tableau.
    isNullableString(value.description) &&
    isNullableNumber(value.startDate) &&
    isNullableNumber(value.endDate) &&
    isMilestoneStatus(value.status)
  );
}

/**
 * Capacites RECUES : les treize cles d'origine sont exigees, celles du §11.5
 * tolerees absentes. La forme complete est produite par `completeCapabilities`.
 */
export function isCapabilities(value: unknown): value is CapabilitiesPayload {
  return (
    isRecord(value) &&
    isNullable(isRole)(value.role) &&
    isBoolean(value.canViewBoard) &&
    isBoolean(value.canEditCards) &&
    isBoolean(value.canManageColumns) &&
    isBoolean(value.canManageMembers) &&
    isBoolean(value.canEditBoard) &&
    isBoolean(value.canArchiveBoard) &&
    isBoolean(value.canDeleteBoard) &&
    isBoolean(value.canAttachBoard) &&
    isBoolean(value.canDetachBoard) &&
    isBoolean(value.canLeaveBoard) &&
    isBoolean(value.isExplicitOwner) &&
    isBoolean(value.archived) &&
    isOptional(isBoolean)(value.canReorderColumns) &&
    isOptional(isBoolean)(value.canRenameColumns) &&
    isOptional(isBoolean)(value.canArchiveCards) &&
    isOptional(isBoolean)(value.canManageMilestones) &&
    isOptional(isBoolean)(value.canEditCredits) &&
    isOptional(isBoolean)(value.canManageRoles) &&
    isOptional(isBoardSource)(value.source)
  );
}

export function isBoardSnapshot(value: unknown): value is BoardSnapshotPayload {
  return (
    isRecord(value) &&
    isBoard(value.board) &&
    isArrayOf(isColumn)(value.columns) &&
    isArrayOf(isCard)(value.cards) &&
    isArrayOf(isMember)(value.members) &&
    isCapabilities(value.capabilities) &&
    isOptional(isArrayOf(isMilestone))(value.milestones)
  );
}

export function isActivity(value: unknown): value is Activity {
  return (
    isRecord(value) &&
    isString(value._id) &&
    isString(value.boardId) &&
    isNullableString(value.cardId) &&
    isNullableString(value.columnId) &&
    isString(value.actorId) &&
    isOneOf(ACTIVITY_VERBS)(value.verb) &&
    isRecord(value.payload) &&
    isNumber(value.rev) &&
    isNumber(value.at)
  );
}

export function isSyncResult(value: unknown): value is SyncResult {
  if (!isRecord(value) || !isNumber(value.rev) || !isBoolean(value.full)) return false;
  // `full: true` dispense d'activites : le client recharge tout.
  return value.full === true || isArrayOf(isActivity)(value.activities);
}

export function isRankUpdate(value: unknown): value is RankUpdate {
  return isRecord(value) && isString(value.id) && isNumber(value.rank);
}

export function isBoardWithColumns(value: unknown): value is BoardWithColumns {
  return isRecord(value) && isBoard(value.board) && isArrayOf(isColumn)(value.columns);
}

export function isBoardCreateResult(value: unknown): value is BoardCreateResult {
  return isRecord(value) && isBoardWithColumns(value) && isOptional(isBoolean)(value.created);
}

export function isColumnMoveResult(value: unknown): value is ColumnMoveResult {
  return (
    isRecord(value) && isColumn(value.column) && isOptional(isArrayOf(isRankUpdate))(value.renumbered)
  );
}

export function isCardEnvelope(value: unknown): value is { card: Card } {
  return isRecord(value) && isCard(value.card);
}

function isWipWarning(value: unknown): value is WipWarning {
  return (
    isRecord(value) && isString(value.columnId) && isNumber(value.limit) && isNumber(value.count)
  );
}

export function isCardMoveResult(value: unknown): value is CardMoveResult {
  return (
    isRecord(value) &&
    isCard(value.card) &&
    isOptional(isArrayOf(isRankUpdate))(value.renumbered) &&
    isOptional(isWipWarning)(value.wipWarning)
  );
}

export function isCardArchiveResult(value: unknown): value is CardArchiveResult {
  return isRecord(value) && value.archived === true;
}

export function isCommentListResult(value: unknown): value is CommentListResult {
  return isRecord(value) && isArrayOf(isCardComment)(value.comments) && isNumber(value.total);
}

export function isCommentAddResult(value: unknown): value is CommentAddResult {
  return isRecord(value) && isCardComment(value.comment) && isNumber(value.commentCount);
}

export function isCommentDeleteResult(value: unknown): value is CommentDeleteResult {
  return isRecord(value) && value.deleted === true && isNumber(value.commentCount);
}

export function isMilestoneEnvelope(value: unknown): value is { milestone: Milestone } {
  return isRecord(value) && isMilestone(value.milestone);
}

export function isMilestoneListResult(value: unknown): value is MilestoneListResult {
  return isRecord(value) && isArrayOf(isMilestone)(value.milestones);
}

export function isRoleEntry(value: unknown): value is RoleEntry {
  return isRecord(value) && isString(value.name) && isBoolean(value.declared) && isStringArray(value.memberIds);
}

export function isRoleMember(value: unknown): value is RoleMember {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isRoleMemberType(value.type) &&
    isString(value.name) &&
    isString(value.slug) &&
    isNullableString(value.image) &&
    isBoolean(value.isAdmin) &&
    isBoolean(value.pending) &&
    isStringArray(value.roles)
  );
}

export function isRoleListResult(value: unknown): value is RoleListResult {
  return (
    isRecord(value) &&
    isArrayOf(isRoleEntry)(value.roles) &&
    isArrayOf(isRoleMember)(value.members) &&
    // EXIGE : la vue grise ou non ses commandes dessus, un `undefined` les
    // grisrait a tort pour un administrateur.
    isBoolean(value.canManageRoles) &&
    isNumber(value.rev)
  );
}

export function isRoleMemberRef(value: unknown): value is RoleMemberRef {
  return isRecord(value) && isString(value.id) && isRoleMemberType(value.type) && isStringArray(value.roles);
}

export function isRoleWriteResult(value: unknown): value is RoleWriteResult {
  return isRecord(value) && isRoleMemberRef(value.member) && isBoolean(value.changed) && isNumber(value.rev);
}

export function isRoleCreateResult(value: unknown): value is RoleCreateResult {
  return isRecord(value) && isString(value.role) && isBoolean(value.created) && isNumber(value.rev);
}

export function isRoleDeleteResult(value: unknown): value is RoleDeleteResult {
  return isRecord(value) && isString(value.role) && isNumber(value.removedFrom) && isNumber(value.rev);
}
