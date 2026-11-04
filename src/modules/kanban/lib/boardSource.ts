/**
 * Les DEUX sources d'un tableau (blueprint §11) — logique PURE et testee.
 *
 * Un board `kanban` porte ses colonnes et ses cartes ; un board-lien
 * `communecter` est une vue sur les `actions` d'un projet ou, depuis le §12,
 * d'une ORGANISATION (`parentType`). Ce module concentre ce qui distingue les
 * sources — et les deux types d'element d'un lien — pour que le reste du front
 * n'ait jamais a tester `board.source` ou `board.parentType` a la main (un
 * champ absent vaut `kanban`, et l'oublier une seule fois traiterait un
 * board-lien comme un board vide, ou offrirait des jalons a une organisation).
 *
 * Il normalise aussi `board/get` : les capacites du §11.5 et les jalons sont
 * COMPLETES ici, une fois, a la frontiere du transport. Derriere, tout le cache
 * porte des capacites completes et l'interface peut lire
 * `capabilities.canArchiveCards` sans se demander quel module PHP a repondu.
 */
import type { DateZone } from '@/modules/kanban/lib/dates';
import { isKanbanApiError } from '@/modules/kanban/lib/kanbanErrors';
import {
  COMMUNECTER_COLUMN_IDS,
  isOneOf,
  type BoardSnapshot,
  type BoardSnapshotPayload,
  type BoardSource,
  type Capabilities,
  type CapabilitiesPayload,
  type CardStatus,
  type CommunecterColumnId,
  type ParentType,
} from '@/modules/kanban/types';

/** Source d'un tableau : absent = `kanban` (§11.2, aucune migration des boards existants). */
export function boardSourceOf(board: { source?: BoardSource }): BoardSource {
  return board.source ?? 'kanban';
}

export function isCommunecterBoard(board: { source?: BoardSource }): boolean {
  return boardSourceOf(board) === 'communecter';
}

/** Ce que les regles par type d'element lisent d'un tableau : sa source et son parent. */
export type LinkedBoardLike = { source?: BoardSource; parentType?: ParentType | null };

/**
 * Type de l'element d'un board-lien. Un lien SANS `parentType` est un projet :
 * les liens anterieurs au §12 n'en portaient pas sur le fil (aucune migration,
 * §12.2). N'a de sens que sur un board-lien ; `null` sur un board kanban, dont
 * le parent eventuel est un rattachement, pas une source.
 */
export function linkParentType(board: LinkedBoardLike): ParentType | null {
  if (!isCommunecterBoard(board)) return null;
  return board.parentType ?? 'projects';
}

/** Board-lien sur une ORGANISATION (§12, D19). */
export function isOrganizationLink(board: LinkedBoardLike): boolean {
  return linkParentType(board) === 'organizations';
}

/**
 * Le tableau a-t-il des JALONS ? Seul le board-lien d'un PROJET (§11.6) : une
 * organisation n'en a pas (D22, `milestones: []`, 409 `milestonesUnavailable`),
 * un board kanban non plus. Ce predicat gouverne la vue Jalons, la boite des
 * jalons, le filtre et le selecteur de jalon de la fiche.
 */
export function hasMilestones(board: LinkedBoardLike): boolean {
  return linkParentType(board) === 'projects';
}

/**
 * Cle i18n du type d'element (« Projet » / « Organisation ») : UN catalogue
 * pour le badge du selecteur, la tuile et les textes declines par type.
 */
export function elementTypeLabelKey(type: ParentType): string {
  return `elements.type.${type}`;
}

const isParentType: (value: unknown) => value is ParentType = isOneOf<ParentType>(['organizations', 'projects']);

/**
 * Cle i18n du refus 403 `notMember` de `board/create` sur un element Communecter
 * (§11.6, D19), ou `null` pour tout autre echec.
 *
 * Il n'y a pas encore de tableau : le message generique du code (« Vous n'etes
 * pas membre de ce tableau ») dirait faux. Le texte nomme le type d'element —
 * lu dans le detail du refus (`{parentType, parentId}`, sans `reason`), sinon
 * celui de l'element choisi dans la boite.
 */
export function linkMembershipRefusalKey(error: unknown, chosenType: ParentType): string | null {
  if (!isKanbanApiError(error) || error.code !== 'notMember') return null;
  const detail: unknown = error.detail;
  const served = typeof detail === 'object' && detail !== null && 'parentType' in detail ? detail.parentType : undefined;
  return `boards.errors.notMember.${isParentType(served) ? served : chosenType}`;
}

export const isCommunecterColumnId: (value: unknown) => value is CommunecterColumnId =
  isOneOf(COMMUNECTER_COLUMN_IDS);

/** Colonnes posees a la creation d'un board kanban (RG-3). */
const KANBAN_DEFAULT_COLUMN_KEYS = ['todo', 'doing', 'done'] as const;

const isKanbanDefaultColumnKey = isOneOf(KANBAN_DEFAULT_COLUMN_KEYS);

/**
 * `titleKey` que le catalogue traduit (`column.defaults.<cle>`) : les colonnes
 * par defaut d'un board kanban et les six statuts d'un board-lien (§11.3).
 *
 * UNE regle pour les deux resolveurs de titre (`columnDisplayTitle`,
 * `resolveColumnTitle`) : le second ne connaissait que les trois cles kanban,
 * si bien qu'un « En cours » d'un board-lien restait dans la langue servie
 * par le serveur quand on changeait celle de l'interface. Une cle inconnue
 * (module plus recent) garde le titre du serveur plutot que la cle brute.
 */
export function isTranslatableColumnKey(key: unknown): key is string {
  return isKanbanDefaultColumnKey(key) || isCommunecterColumnId(key);
}

/**
 * Fuseau du JOUR CIVIL des dates d'un tableau (cf. l'en-tete de `lib/dates`) :
 * UTC pour un board kanban, que co-kanban ecrit a minuit UTC ; fuseau du
 * navigateur pour un board-lien, dont les actions sont saisies et relues ainsi
 * par Kanban gestion — sinon les deux interfaces affichent deux jours.
 */
export function dateZoneFor(source: BoardSource): DateZone {
  return source === 'communecter' ? 'local' : 'utc';
}

/**
 * Statut d'une action, DERIVE de sa colonne (§11.4) : `done` -> `complete`,
 * `tracking` -> `on_track`, toute autre colonne -> `not_started`.
 *
 * Lu sur la COLONNE et non sur le champ `tracking` : une action `tracking` qui
 * porte aussi le tag `totest` est rangee dans « A tester » par
 * `Action::get_action_status` (le tag passe avant), et son statut doit dire ce
 * que la colonne montre.
 */
export function communecterStatusForColumn(columnId: string): CardStatus {
  if (columnId === 'done') return 'complete';
  if (columnId === 'tracking') return 'on_track';
  return 'not_started';
}

/** Statuts qu'une carte peut porter selon la source — ceux qu'un filtre a du sens a proposer. */
export function cardStatusesFor(source: BoardSource): readonly CardStatus[] {
  return source === 'communecter'
    ? ['not_started', 'on_track', 'complete']
    : ['not_started', 'in_research', 'on_track', 'complete'];
}

/**
 * Capacites COMPLETES a partir de celles recues.
 *
 * Un module anterieur au §11 n'envoie pas les six cles nouvelles. Pour un board
 * `kanban`, la table §11.5 les definit a partir d'AUTRES capacites calculees
 * par le serveur (`canReorderColumns = canManageColumns`…) : on l'applique.
 * Pour un board-lien, un serveur qui sait le servir sait les envoyer ; s'il ne
 * le fait pas, rien n'est permis. Jamais de deduction depuis le role (D10).
 */
export function completeCapabilities(
  payload: CapabilitiesPayload,
  fallbackSource: BoardSource,
): Capabilities {
  const source = payload.source ?? fallbackSource;
  const kanban = source === 'kanban';
  return {
    ...payload,
    canReorderColumns: payload.canReorderColumns ?? (kanban && payload.canManageColumns),
    canRenameColumns: payload.canRenameColumns ?? (kanban && payload.canManageColumns),
    canArchiveCards: payload.canArchiveCards ?? (kanban && payload.canEditCards),
    canManageMilestones: payload.canManageMilestones ?? false,
    canEditCredits: payload.canEditCredits ?? false,
    // §12.3 : un module anterieur au kanban des roles ne l'envoie pas — et
    // n'en sert pas les routes, donc rien n'est permis.
    canManageRoles: payload.canManageRoles ?? false,
    source,
  };
}

/**
 * Instantane NORMALISE de `board/get`.
 *
 * Champs recopies un a un, sans etaler la charge utile : une cle inconnue
 * envoyee par un backend plus recent ne doit pas s'installer dans le cache,
 * ou rien ne la maintiendrait a jour.
 */
export function toBoardSnapshot(payload: BoardSnapshotPayload): BoardSnapshot {
  const source = payload.capabilities.source ?? boardSourceOf(payload.board);
  return {
    board: payload.board,
    columns: payload.columns,
    cards: payload.cards,
    members: payload.members,
    capabilities: completeCapabilities(payload.capabilities, source),
    milestones: payload.milestones ?? [],
  };
}

/** Source de l'instantane : celle des capacites, normalisee par `toBoardSnapshot`. */
export function snapshotSource(snapshot: Pick<BoardSnapshot, 'capabilities'>): BoardSource {
  return snapshot.capabilities.source;
}

/**
 * Faut-il recharger l'instantane pour que ses libelles parlent la langue de
 * l'interface ? Un board-lien recoit les libelles PERSONNALISES de ses colonnes
 * dans la langue demandee (§11.3), et la langue n'est pas dans la cle de cache :
 * un tableau rouvert apres un changement de langue, ou dont le menu de tuile
 * relit l'instantane, garderait sinon les libelles de l'ancienne langue. Un
 * board kanban se traduit par `titleKey`, sans aller-retour.
 */
export function labelsLanguageStale(
  snapshot: Pick<BoardSnapshot, 'capabilities' | 'servedLanguage'>,
  language: 'fr' | 'en',
): boolean {
  return snapshot.capabilities.source !== 'kanban' && snapshot.servedLanguage !== language;
}
