/**
 * Routes `board/*` de l'API kanban (blueprint §3 et §11.6).
 *
 * Chaque route se designe par sa constante du registre du SDK (`transport/kanbanRoutes.ts`) ;
 * site-json n'utilise que les routes d'un tableau RELIE a l'element porteur du site.
 *
 * Chaque fonction impose une garde de type sur la reponse : un backend qui
 * devie du contrat echoue ici, pas trois composants plus loin.
 */
import type { KanbanClient, KanbanRequestOptions } from '@/modules/kanban/transport/kanbanClient';
import { toBoardSnapshot } from '@/modules/kanban/lib/boardSource';
import type { InterfaceLanguage } from '@/modules/kanban/lib/language';
import {
  isBoardCreateResult,
  isBoardSnapshot,
  isSyncResult,
  type BoardCreateResult,
  type BoardSnapshot,
  type ParentType,
  type SyncResult,
} from '@/modules/kanban/types';

export interface GetBoardOptions extends KanbanRequestOptions {
  /**
   * Langue des libelles PERSONNALISES des colonnes d'un board-lien (§11.3) ;
   * sans elle, le serveur suivrait la langue du navigateur. Ignoree par un
   * board kanban, dont les colonnes se traduisent par `titleKey`.
   */
  lang?: InterfaceLanguage;
}

/**
 * Instantane complet, NORMALISE a la frontiere : capacites du §11.5 completees
 * et jalons toujours presents (cf. `toBoardSnapshot`). Tout le cache porte
 * donc la forme complete, quel que soit le module PHP qui a repondu.
 */
export async function getBoard(
  client: KanbanClient,
  boardId: string,
  options: GetBoardOptions = {},
): Promise<BoardSnapshot> {
  const { lang, ...transport } = options;
  const body = lang === undefined ? { boardId } : { boardId, lang };
  const payload = await client.post('KANBAN_BOARD_GET_URL', body, isBoardSnapshot, transport);
  const snapshot = toBoardSnapshot(payload);
  // La langue demandee est celle des libelles recus : on la retient sur
  // l'instantane (cf. `BoardSnapshot.servedLanguage`).
  return lang === undefined ? snapshot : { ...snapshot, servedLanguage: lang };
}

/** Board-lien sur un projet ou une organisation Communecter existants (§11.6 D11-D12, §12 D19). */
export interface CreateLinkedBoardInput {
  source: 'communecter';
  parentType: ParentType;
  parentId: string;
  /** Langue des libelles personnalises des six colonnes renvoyees (§11.3). */
  lang?: InterfaceLanguage;
}

/**
 * Tableau relie a l'element : IDEMPOTENT, renvoie le lien existant avec `created: false` ;
 * un element supprime (ou une organisation `deletePending`) repond 404
 * `sourceMissing`, un non-membre 403 `notMember` (§12.3).
 */
export function createBoard(
  client: KanbanClient,
  input: CreateLinkedBoardInput,
  options?: KanbanRequestOptions,
): Promise<BoardCreateResult> {
  return client.post('KANBAN_BOARD_CREATE_URL', input, isBoardCreateResult, options);
}

/**
 * Polling delta : renvoie les activites posterieures a `sinceRev`, ou
 * `{full:true}` quand le client a trop de retard pour rejouer le journal — ou
 * qu'une ecriture faite dans Kanban gestion a change l'empreinte d'un
 * board-lien (D17).
 */
export function syncBoard(
  client: KanbanClient,
  input: { boardId: string; sinceRev: number },
  options?: KanbanRequestOptions,
): Promise<SyncResult> {
  return client.post('KANBAN_BOARD_SYNC_URL', input, isSyncResult, options);
}
