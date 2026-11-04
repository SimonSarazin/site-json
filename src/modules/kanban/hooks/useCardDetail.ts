/**
 * Carte COMPLETE pour la fiche, quand l'instantane ne la porte qu'en partie.
 *
 * Sur un board-lien, `board/get` sert les checklists dans un BUDGET d'octets
 * (§11.9 E29) : au-dela, une carte arrive `checklist: []` et
 * `checklistTruncated: true`, compteurs exacts. Un brouillon fait de cette
 * carte-la montrerait une checklist vide, et la liste vide partirait comme
 * BASE de la fusion a trois. La fiche lit donc la carte par `card/get`, qui
 * sert toujours la liste entiere, et n'en fait son brouillon qu'a la reponse.
 *
 * Inerte pour une carte complete : c'est le cas courant, et celui de tout board
 * kanban. La carte lue n'est PAS posee dans l'instantane : sans optimiste de
 * checklist sur une carte tronquee (`cardPatchFromUpdate`), c'est la reponse de
 * `card/update` qui y met la carte complete.
 */
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { getCard } from '@/modules/kanban/api/cards';
import { KANBAN_QUERY_KEYS } from '@/modules/kanban/constants/queryKeys';
import { useCurrentUserId, useKanbanClient } from '@/modules/kanban/hooks/useKanbanSession';
import type { Card } from '@/modules/kanban/types';
import { shouldRetryKanbanQuery } from '@/modules/kanban/lib/kanbanErrors';

/**
 * @param boardId tableau de la carte : il designe la SOURCE (§11.6).
 * @param card carte de l'instantane ; `null` / `undefined` tant qu'elle n'est
 *   pas connue (lien profond en cours de chargement).
 */
export function useCardDetail(boardId: string, card: Card | null | undefined): UseQueryResult<Card, Error> {
  const client = useKanbanClient();
  const userId = useCurrentUserId();
  const cardId = card?._id ?? '';

  return useQuery({
    queryKey: KANBAN_QUERY_KEYS.CARD(userId, boardId, cardId),
    queryFn: ({ signal }) => getCard(client, { boardId, cardId }, { signal }),
    retry: shouldRetryKanbanQuery,
    enabled: card?.checklistTruncated === true && userId !== null && boardId.length > 0 && cardId.length > 0,
    // Relue a CHAQUE ouverture, jamais servie d'un cache : la fiche montre ce
    // que le serveur porte maintenant, et la base de sa fusion est la liste
    // qu'elle a reellement vue.
    staleTime: 0,
    gcTime: 0,
  });
}
