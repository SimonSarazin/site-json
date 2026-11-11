/**
 * Instantane complet d'un tableau (`board/get`).
 *
 * C'est le SEUL chargement du tableau : colonnes, cartes, membres et
 * capacites arrivent ensemble. Les mutations optimistes et le polling delta
 * ecrivent ensuite dans cette meme entree de cache, sans jamais la reinvalider
 * systematiquement.
 */
import { useEffect } from 'react';
import { useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { getBoard } from '@/modules/kanban/api/boards';
import { labelsLanguageStale } from '@/modules/kanban/lib/boardSource';
import type { InterfaceLanguage } from '@/modules/kanban/lib/language';
import { KANBAN_QUERY_KEYS } from '@/modules/kanban/constants/queryKeys';
import { useCurrentUserId, useKanbanClient } from '@/modules/kanban/hooks/useKanbanSession';
import { useInterfaceLanguage } from '@/modules/kanban/hooks/useInterfaceLanguage';
import type { KanbanClient } from '@/modules/kanban/transport/kanbanClient';
import type { BoardSnapshot } from '@/modules/kanban/types';
import { shouldRetryKanbanQuery } from '@/modules/kanban/lib/kanbanErrors';

/**
 * Options de la lecture de l'instantane. Les lecteurs secondaires de co-kanban
 * (revision, capacites, jalons) n'ont pas ete repris : le tableau des actions et
 * la vue Roles lisent l'instantane entier.
 */
function boardQueryOptions(client: KanbanClient, userId: string | null, boardId: string, lang: InterfaceLanguage) {
  return {
    // `lang` n'est PAS dans la cle : il ne change que les libelles personnalises
    // des colonnes d'un board-lien, et la cle est ecrite en place par toutes les
    // mutations et par le polling. L'instantane retient la langue servie
    // (`servedLanguage`) et `useBoard` le recharge quand elle n'est plus celle
    // de l'interface, au lieu de dedoubler son entree de cache.
    queryKey: KANBAN_QUERY_KEYS.BOARD(userId, boardId),
    queryFn: ({ signal }: { signal: AbortSignal }) => getBoard(client, boardId, { signal, lang }),
    retry: shouldRetryKanbanQuery,
    enabled: userId !== null && boardId.length > 0,
  };
}

/**
 * @param boardId `null` ou chaine vide = aucun tableau selectionne : la query
 * reste desactivee (cas du filtre « tous les tableaux » de la vue liste).
 */
export function useBoard(boardId: string | null): UseQueryResult<BoardSnapshot, Error> {
  const client = useKanbanClient();
  const queryClient = useQueryClient();
  const userId = useCurrentUserId();
  const lang = useInterfaceLanguage();
  const id = boardId ?? '';

  const query = useQuery(boardQueryOptions(client, userId, id, lang));
  const staleLanguage = query.data !== undefined && labelsLanguageStale(query.data, lang);

  useEffect(() => {
    /*
     * Rechargement quand les libelles servis ne sont plus dans la langue de
     * l'interface — a CHAQUE montage, pas seulement pendant qu'un tableau est
     * ouvert : rouvrir un board-lien apres avoir change de langue sur « Mes
     * projets » (ou ouvrir le menu de sa tuile) relisait sinon le cache encore
     * frais, dans l'ancienne langue. Plusieurs composants lisent l'instantane
     * en meme temps : le premier qui le recharge suffit aux autres.
     */
    if (!staleLanguage || userId === null || id.length === 0) return;
    const queryKey = KANBAN_QUERY_KEYS.BOARD(userId, id);
    if (queryClient.isFetching({ queryKey }) > 0) return;
    void queryClient.invalidateQueries({ queryKey });
    // `dataUpdatedAt` est une SENTINELLE : un `board/get` parti dans l'ancienne
    // langue peut atterrir apres le changement — `staleLanguage` reste alors a
    // `true` et, sans elle, l'effet ne se rejouerait plus. Pas de boucle : la
    // relecture suivante porte la langue courante, et un echec ne change rien.
  }, [staleLanguage, query.dataUpdatedAt, queryClient, userId, id]);

  return query;
}

