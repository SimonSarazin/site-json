import { isKanbanApiError, kanbanFailureKind } from '@/modules/kanban/lib/kanbanErrors';
import type { ContextParent } from '@/modules/kanban/lib/contextParent';

/**
 * État d'accès aux kanbans de l'élément porteur, dans l'ordre où il se décide :
 *  - `pending`     : session pas encore connue (rendu serveur, premier rendu client) ou
 *                    tableau en cours de chargement ;
 *  - `unavailable` : le porteur du site n'est ni une organisation ni un projet ;
 *  - `anonymous`   : visiteur non connecté ;
 *  - `notMember`   : le serveur refuse (403 `notMember` / `forbidden`) ;
 *  - `failed`      : autre échec (réseau, serveur…), à réessayer ;
 *  - `open`        : accès ouvert.
 */
export type KanbanAccessState = 'pending' | 'unavailable' | 'anonymous' | 'notMember' | 'failed' | 'open';

export interface KanbanAccessInput {
  hydrated: boolean;
  userId: string | null;
  parent: ContextParent | null;
  /** Erreur de `board/create` (`useContextBoard`), `null` sinon. */
  error: unknown;
  /** Le tableau est-il chargé ? Absent : l'appelant ne décide que des refus. */
  loaded?: boolean;
}

/**
 * Décide l'état d'accès. Pure et testée : c'est elle qui garantit qu'aucune invite de
 * connexion ne s'affiche avant hydratation (le rendu serveur ne connaît pas la session).
 * Une session expirée (401) se traite comme un visiteur anonyme : se reconnecter.
 */
export function kanbanAccessState({ hydrated, userId, parent, error, loaded }: KanbanAccessInput): KanbanAccessState {
  if (!hydrated) return 'pending';
  if (parent === null) return 'unavailable';
  if (userId === null) return 'anonymous';
  if (error !== null && error !== undefined) {
    if (kanbanFailureKind(error) !== 'denied') return 'failed';
    return isKanbanApiError(error) && error.status === 401 ? 'anonymous' : 'notMember';
  }
  return loaded === false ? 'pending' : 'open';
}
