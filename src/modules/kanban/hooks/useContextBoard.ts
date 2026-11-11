import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { useCocolight } from '@/hooks/useCocolight';
import { createBoard } from '@/modules/kanban/api/boards';
import { KANBAN_QUERY_KEYS } from '@/modules/kanban/constants/queryKeys';
import { useCurrentUserId, useKanbanClient } from '@/modules/kanban/hooks/useKanbanSession';
import { useInterfaceLanguage } from '@/modules/kanban/hooks/useInterfaceLanguage';
import { contextParent, type ContextParent } from '@/modules/kanban/lib/contextParent';
import { shouldRetryKanbanQuery } from '@/modules/kanban/lib/kanbanErrors';
import type { BoardCreateResult } from '@/modules/kanban/types';

export interface ContextBoard {
  /** L'élément porteur du site, ou `null` quand il n'a pas de kanban (ni organisation, ni projet). */
  parent: ContextParent | null;
  /** Nom de l'élément porteur : le refus `notMember` ne le porte pas, le site le connaît. */
  parentName: string | null;
  /** Le tableau relié (`board/create`, idempotent) ; désactivé sans utilisateur ni porteur. */
  query: UseQueryResult<BoardCreateResult, Error>;
}

/**
 * Le tableau relié à l'élément qui porte le site.
 *
 * `board/create {source:"communecter"}` est IDEMPOTENT : il renvoie le lien existant
 * (`created: false`), et c'est le premier membre qui ouvre `/kanban` qui le crée. D'où une
 * QUERY, pas une mutation : la réponse est une lecture pour tous les visiteurs suivants. Le
 * serveur tranche les droits : un non-membre reçoit 403 `notMember`.
 *
 * La réponse porte déjà `board.counts` et le `cardCount` de chaque colonne : l'écran de liste
 * en tire ses chiffres sans charger l'instantané complet (`board/get`).
 */
export function useContextBoard(): ContextBoard {
  const client = useKanbanClient();
  const userId = useCurrentUserId();
  const lang = useInterfaceLanguage();
  const { contextType, contextId, entity } = useCocolight();
  const parent = contextParent(contextType, contextId);

  const query = useQuery({
    queryKey: parent
      ? KANBAN_QUERY_KEYS.CONTEXT_BOARD(userId, parent.parentType, parent.parentId)
      : KANBAN_QUERY_KEYS.CONTEXT_BOARD_NONE(),
    queryFn: ({ signal }) => {
      // `enabled` garantit le porteur ; la garde reste pour le typage, sans cast.
      if (!parent) throw new Error('Aucun élément porteur');
      return createBoard(client, { source: 'communecter', ...parent, lang }, { signal });
    },
    enabled: userId !== null && parent !== null,
    retry: shouldRetryKanbanQuery,
    // Le lien d'un élément ne change pas tant qu'il existe : inutile de le relire à chaque
    // passage sur l'écran de liste. Les chiffres des tuiles peuvent donc dater de quelques
    // minutes ; le tableau, lui, se synchronise toutes les 10 s.
    staleTime: 5 * 60_000,
  });

  const name = entity?.serverData?.name;
  return { parent, parentName: typeof name === 'string' && name !== '' ? name : null, query };
}
