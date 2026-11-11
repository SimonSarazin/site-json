/**
 * Routes `column/*` de l'API kanban (blueprint §3).
 *
 * Sur un board-lien (§11), seul `column/move` existe (owner) : creer, renommer
 * ou supprimer une colonne repond 409 `sourceManaged`, les six colonnes sont
 * les statuts de Kanban gestion.
 */
import { sdkColumnId, type KanbanClient, type KanbanRequestOptions } from '@/modules/kanban/transport/kanbanClient';
import type { InterfaceLanguage } from '@/modules/kanban/lib/language';
import {
  isColumnMoveResult,
  type ColumnMoveResult,
} from '@/modules/kanban/types';

export type MoveColumnInput = {
  /**
   * Designe la source (§11.6) : sur un board-lien, `columnId` est un statut
   * virtuel (`todo`, `next`…) et le deplacement reecrit l'ordre du PROJET
   * (`kanbanColumnOrder.actions`), d'ou la reponse `renumbered`.
   */
  boardId: string;
  columnId: string;
  /** Intention de placement : le SERVEUR calcule le rang definitif (D9). */
  beforeColumnId?: string;
  afterColumnId?: string;
  /** Board-lien : langue du libelle personnalise de la colonne renvoyee (§11.3). */
  lang?: InterfaceLanguage;
};

export function moveColumn(
  client: KanbanClient,
  input: MoveColumnInput,
  options?: KanbanRequestOptions,
): Promise<ColumnMoveResult> {
  return client.call('KANBAN_COLUMN_MOVE_URL', (kanban) =>
      kanban.column.move({
        ...input,
        columnId: sdkColumnId(input.columnId),
        beforeColumnId: input.beforeColumnId === undefined ? undefined : sdkColumnId(input.beforeColumnId),
        afterColumnId: input.afterColumnId === undefined ? undefined : sdkColumnId(input.afterColumnId),
      }), isColumnMoveResult, options);
}

