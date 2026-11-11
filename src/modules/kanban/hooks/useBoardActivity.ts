/**
 * Activité récente d'un tableau, pour la Vue d'ensemble. Reprise de co-kanban
 * (`hooks/useBoardActivity.ts`), sans le marqueur « vu » de sa cloche (cf. `lib/activityFeed`).
 *
 * Aucune route dédiée : le journal est déjà servi par `board/sync`, qui rend les activités
 * POSTÉRIEURES à une révision. On lui demande une FENÊTRE glissante (`rev - BOARD_ACTIVITY_WINDOW`)
 * au lieu d'un delta.
 *
 *  1. `rev` fait partie de la clé : la réponse décrit un état FIGÉ du journal (`staleTime:
 *     Infinity`), et c'est l'avancée de la révision, déjà assurée par le polling delta, qui
 *     rafraîchit le fil. Pas de second minuteur sur le serveur.
 *  2. `placeholderData: keepPreviousData` : sans lui, chaque écriture viderait la liste une
 *     fraction de seconde.
 *  3. Les INSTANTS d'activité s'affichent dans le fuseau du NAVIGATEUR (« 14:05 » à La Réunion),
 *     qui n'existe qu'au navigateur : `zone` vaut `utc` au rendu serveur et au premier rendu
 *     client (même HTML), `local` ensuite.
 */
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { syncBoard } from '@/modules/kanban/api/boards';
import { KANBAN_QUERY_KEYS } from '@/modules/kanban/constants/queryKeys';
import { useCurrentUserId, useKanbanClient, useKanbanHydrated } from '@/modules/kanban/hooks/useKanbanSession';
import { sortActivitiesDesc } from '@/modules/kanban/lib/activityFeed';
import type { DateZone } from '@/modules/kanban/lib/dates';
import { shouldRetryKanbanQuery } from '@/modules/kanban/lib/kanbanErrors';
import type { Activity } from '@/modules/kanban/types';

/**
 * Profondeur de la fenêtre, en révisions. Une révision = une écriture sur le tableau ou ses
 * enfants : quarante couvre largement ce que la Vue d'ensemble montre, et borne la réponse.
 */
export const BOARD_ACTIVITY_WINDOW = 40;

export interface BoardActivityFeed {
  /** Les plus récentes d'abord. */
  activities: Activity[];
  /** Fuseau d'affichage des instants `at` (cf. choix 3). */
  zone: DateZone;
  isLoading: boolean;
  error: Error | null;
}

const NO_ACTIVITY: Activity[] = [];

/**
 * @param rev révision de l'instantané déjà chargé ; `0` tant qu'il ne l'est pas (on ne sait
 * alors pas quelle fenêtre demander).
 */
export function useBoardActivity(boardId: string, rev: number): BoardActivityFeed {
  const client = useKanbanClient();
  const userId = useCurrentUserId();
  const zone: DateZone = useKanbanHydrated() ? 'local' : 'utc';

  const query = useQuery({
    queryKey: KANBAN_QUERY_KEYS.BOARD_ACTIVITY(userId, boardId, rev),
    queryFn: async ({ signal }) => {
      // `sinceRev: 0` a un sens spécial côté serveur (« recharge tout ») : on ne descend jamais
      // sous 1, quitte à laisser la toute première activité hors fenêtre.
      const result = await syncBoard(client, { boardId, sinceRev: Math.max(1, rev - BOARD_ACTIVITY_WINDOW) }, { signal });
      // `full: true` = le journal ne couvre plus la fenêtre demandée : un fil vide est la seule
      // réponse honnête.
      return result.full ? NO_ACTIVITY : sortActivitiesDesc(result.activities);
    },
    enabled: userId !== null && boardId.length > 0 && rev > 0,
    placeholderData: keepPreviousData,
    staleTime: Infinity,
    retry: shouldRetryKanbanQuery,
  });

  return { activities: query.data ?? NO_ACTIVITY, zone, isLoading: query.isLoading, error: query.error };
}
