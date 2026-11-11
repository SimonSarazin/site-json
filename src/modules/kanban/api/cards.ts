/**
 * Routes `card/*` de l'API kanban (blueprint §3 et §11.6).
 *
 * Depuis le §11, TOUTE route de carte recoit `boardId` en plus de `cardId` :
 * c'est lui qui designe la source. Une carte d'un board-lien est une action
 * Communecter, et seul le tableau dit au serveur ou la chercher et avec
 * quels droits.
 */
import { sdkColumnId, type KanbanClient, type KanbanRequestOptions } from '@/modules/kanban/transport/kanbanClient';
import {
  isCardArchiveResult,
  isCardEnvelope,
  isCardMoveResult,
  type Card,
  type CardArchiveResult,
  type CardLink,
  type CardMoveResult,
  type CardStatus,
  type ChecklistItem,
  type Priority,
} from '@/modules/kanban/types';

/** Designation d'une carte : le tableau (la source) ET la carte. */
export type CardRef = {
  boardId: string;
  cardId: string;
};

export type CreateCardInput = {
  boardId: string;
  /** Colonne de depot : exigee par le registre du SDK (un board-lien en a six, le statut en decoule). */
  columnId: string;
  title: string;
  description?: string;
  /**
   * Board kanban : absent = `medium`. Board-lien : absent ou `null` = aucune
   * priorite, le defaut de Communecter.
   */
  priority?: Priority | null;
  /**
   * Absent = `not_started`, sauf naissance dans une colonne de cloture qui
   * force `complete` : c'est le SERVEUR qui arbitre, pas l'appelant. Ignore
   * sur un board-lien, ou le statut decoule de la colonne.
   */
  status?: CardStatus;
  assignees?: string[];
  /** Board kanban seulement : les etiquettes d'un board-lien sont ses `tags`. */
  labelIds?: string[];
  /** Au plus 20 entrees, `http(s)` uniquement — le serveur refuse le reste. */
  links?: CardLink[];
  dueDate?: number | null;
  /** Board kanban seulement : l'ordre d'un board-lien est canonique (D16). */
  position?: 'top' | 'bottom';
  /** Board-lien : etiquettes libres, pseudo-tags de statut exclus. */
  tags?: string[];
  /** Board-lien : jalon du projet, ou `null`. */
  milestoneId?: string | null;
};

export async function createCard(
  client: KanbanClient,
  input: CreateCardInput,
  options?: KanbanRequestOptions,
): Promise<Card> {
  const { card } = await client.call('KANBAN_CARD_CREATE_URL', (kanban) => kanban.card.create({ ...input, columnId: sdkColumnId(input.columnId) }), isCardEnvelope, options);
  return card;
}

export async function getCard(
  client: KanbanClient,
  ref: CardRef,
  options?: KanbanRequestOptions,
): Promise<Card> {
  const { card } = await client.call('KANBAN_CARD_GET_URL', (kanban) => kanban.card.get(ref), isCardEnvelope, options);
  return card;
}

export type UpdateCardInput = CardRef & {
  title?: string;
  description?: string;
  /** `null` = retirer la priorite (board-lien seulement). */
  priority?: Priority | null;
  /** Le statut choisi dans la modale l'emporte : `card/update` ne le deduit pas. */
  status?: CardStatus;
  assignees?: string[];
  labelIds?: string[];
  /**
   * Liste COMPLETE des liens : elle remplace l'ancienne. Un tableau vide les
   * efface, `undefined` les laisse en place — la nuance est le contrat, un
   * `null` envoye a la place d'un `[]` ne viderait rien.
   */
  links?: CardLink[];
  dueDate?: number | null;
  /** Seul champ ouvert a un `viewer` assigne (blueprint §3). */
  checklist?: ChecklistItem[];
  /** Board-lien : liste COMPLETE des tags libres ; les pseudo-tags de statut sont preserves par le serveur. */
  tags?: string[];
  startDate?: number | null;
  /** Board-lien : jalon du projet, `null` = detacher. */
  milestoneId?: string | null;
  /** Board-lien, owner seulement (`canEditCredits`). */
  credits?: number | null;
  /** Board-lien, owner seulement : minutes entieres. */
  timeSpent?: number | null;
  /*
   * BASES de la fusion a trois (board-lien, protocole `card/update`) : la
   * valeur que la fiche a vue a son OUVERTURE, de meme forme que le champ.
   * Jointe des que la liste correspondante part ; le serveur applique alors la
   * seule difference base -> liste a la valeur actuelle (`lib/cardMerge`), au
   * lieu de remplacer la liste. Sans base : remplacement complet (compatibilite).
   */
  checklistBase?: ChecklistItem[];
  assigneesBase?: string[];
  tagsBase?: string[];
};

export async function updateCard(
  client: KanbanClient,
  input: UpdateCardInput,
  options?: KanbanRequestOptions,
): Promise<Card> {
  const { card } = await client.call('KANBAN_CARD_UPDATE_URL', (kanban) => kanban.card.update(input), isCardEnvelope, options);
  return card;
}

export type MoveCardInput = CardRef & {
  columnId: string;
  /**
   * Intention de placement, pas un rang : deux clients qui calculeraient le
   * meme rang produiraient des ex aequo (blueprint D9). Jamais envoyee pour
   * un board-lien, dont l'ordre est canonique (D16).
   */
  beforeCardId?: string;
  afterCardId?: string;
};

export function moveCard(
  client: KanbanClient,
  input: MoveCardInput,
  options?: KanbanRequestOptions,
): Promise<CardMoveResult> {
  return client.call('KANBAN_CARD_MOVE_URL', (kanban) => kanban.card.move({ ...input, columnId: sdkColumnId(input.columnId) }), isCardMoveResult, options);
}

/**
 * Retire la carte du tableau sans la detruire (§11.6, deux sources) : board
 * kanban -> `archived: true` ; board-lien -> action `status: "disabled"`,
 * comme la corbeille de Kanban gestion. Reserve a `canArchiveCards`.
 */
export function archiveCard(
  client: KanbanClient,
  ref: CardRef,
  options?: KanbanRequestOptions,
): Promise<CardArchiveResult> {
  return client.call('KANBAN_CARD_ARCHIVE_URL', (kanban) => kanban.card.archive(ref), isCardArchiveResult, options);
}

