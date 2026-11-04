/**
 * Routes `comment/*` de l'API kanban (blueprint §3 et §11.6).
 *
 * Particularite de droits : commenter est le SEUL geste d'ecriture ouvert a un
 * `viewer` — tout membre participe a la discussion, meme s'il ne touche pas au
 * contenu des cartes. Supprimer reste reserve a l'auteur ou a un `owner`.
 *
 * Les deux routes d'ecriture renvoient `commentCount` : c'est la valeur
 * d'autorite du compteur denormalise porte par la carte, que le front pose
 * telle quelle au lieu d'incrementer la sienne.
 *
 * `boardId` accompagne TOUJOURS `cardId` (§11.6) : sur un board-lien, le fil
 * vit dans la collection `comments` de Communecter (`contextType: "actions"`),
 * et seul le tableau dit au serveur ou le lire.
 */
import type { KanbanClient, KanbanRequestOptions } from '@/modules/kanban/transport/kanbanClient';
import type { CardRef } from '@/modules/kanban/api/cards';
import {
  isCommentAddResult,
  isCommentDeleteResult,
  isCommentListResult,
  type CommentAddResult,
  type CommentDeleteResult,
  type CommentListResult,
} from '@/modules/kanban/types';

export type ListCommentsInput = CardRef & {
  page?: number;
  limit?: number;
};

/**
 * Lire le fil le marque comme VU cote serveur sur un board-lien
 * (`views.<userId>`) : c'est ce qui fait tomber `unseenComments`.
 */
export function listComments(
  client: KanbanClient,
  input: ListCommentsInput,
  options?: KanbanRequestOptions,
): Promise<CommentListResult> {
  return client.call('KANBAN_COMMENT_LIST_URL', (kanban) => kanban.comment.list(input), isCommentListResult, options);
}

export type AddCommentInput = CardRef & {
  text: string;
};

export function addComment(
  client: KanbanClient,
  input: AddCommentInput,
  options?: KanbanRequestOptions,
): Promise<CommentAddResult> {
  // L'auteur n'est PAS dans la charge utile : il vient de la session cote
  // serveur, sans quoi n'importe qui signerait au nom de n'importe qui.
  return client.call('KANBAN_COMMENT_ADD_URL', (kanban) => kanban.comment.add(input), isCommentAddResult, options);
}

export type DeleteCommentInput = CardRef & {
  commentId: string;
};

export function deleteComment(
  client: KanbanClient,
  input: DeleteCommentInput,
  options?: KanbanRequestOptions,
): Promise<CommentDeleteResult> {
  return client.call('KANBAN_COMMENT_DELETE_URL', (kanban) => kanban.comment.delete(input), isCommentDeleteResult, options);
}
