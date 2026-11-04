/**
 * Jalons d'un board-lien (`milestone/*`, blueprint §11.6).
 *
 * DEUX caches portent les jalons, et c'est voulu :
 *  - l'INSTANTANE du tableau (`BOARD`), charge par `board/get`, que lit la
 *    modale de carte pour son selecteur de jalon ;
 *  - la LISTE dediee (`MILESTONES`), rechargee a l'ouverture de la boite de
 *    gestion, pour qu'elle montre aussi un jalon cree entre-temps dans Kanban
 *    gestion (cette ecriture-la n'est pas journalisee par le module).
 * Chaque ecriture tient les deux a jour, et la liste rechargee recopie son
 * resultat dans l'instantane : la modale de carte ne propose jamais un jeu de
 * jalons plus vieux que celui que la boite vient d'afficher.
 */
import { useMutation, useQuery, useQueryClient, type UseMutationResult, type UseQueryResult } from '@tanstack/react-query';
import {
  createMilestone as requestCreateMilestone,
  listMilestones,
  updateMilestone as requestUpdateMilestone,
  type UpdateMilestoneInput,
} from '@/modules/kanban/api/milestones';
import { useCurrentUserId, useKanbanClient } from '@/modules/kanban/hooks/useKanbanSession';
import {
  boardMutationScope,
  rollbackBoardSnapshot,
  useMutationFailureToast,
  writeOptimisticSnapshot,
} from '@/modules/kanban/hooks/mutationFeedback';
import { milestoneKey, setMilestones, upsertById, upsertMilestone } from '@/modules/kanban/lib/boardSync';
import { applyMilestoneChanges, type MilestoneCreatePayload } from '@/modules/kanban/lib/milestones';
import { KANBAN_QUERY_KEYS } from '@/modules/kanban/constants/queryKeys';
import type { BoardSnapshot, Milestone } from '@/modules/kanban/types';
import { shouldRetryKanbanQuery } from '@/modules/kanban/lib/kanbanErrors';

export interface UseMilestoneListOptions {
  /** Ne charge qu'a l'ouverture de la boite : personne ne paie une requete pour un menu ferme. */
  enabled?: boolean;
}

/** Liste fraiche des jalons du projet (`milestone/list`). */
export function useMilestoneList(
  boardId: string,
  options: UseMilestoneListOptions = {},
): UseQueryResult<Milestone[], Error> {
  const client = useKanbanClient();
  const queryClient = useQueryClient();
  const userId = useCurrentUserId();

  return useQuery({
    queryKey: KANBAN_QUERY_KEYS.MILESTONES(userId, boardId),
    retry: shouldRetryKanbanQuery,
    queryFn: async ({ signal }) => {
      const milestones = await listMilestones(client, boardId, { signal });
      // Recopie dans l'instantane : cf. l'en-tete — le selecteur de la modale
      // de carte doit voir ce que la boite de gestion voit.
      queryClient.setQueryData<BoardSnapshot>(KANBAN_QUERY_KEYS.BOARD(userId, boardId), (current) =>
        current ? setMilestones(current, milestones) : current,
      );
      return milestones;
    },
    enabled: userId !== null && boardId.length > 0 && (options.enabled ?? true),
    // A chaque ouverture : c'est precisement le moment ou l'on veut l'etat
    // reel des jalons, pas celui d'il y a cinq minutes.
    staleTime: 0,
  });
}

export type CreateMilestoneVariables = MilestoneCreatePayload;
export type UpdateMilestoneVariables = Omit<UpdateMilestoneInput, 'boardId'>;

/** Photos prises par `onMutate` : l'instantane ET la liste, restaurees ensemble. */
export interface MilestoneMutationContext {
  previous?: BoardSnapshot;
  optimistic?: BoardSnapshot;
  previousList?: Milestone[];
}

export interface MilestoneMutations {
  create: UseMutationResult<Milestone, Error, CreateMilestoneVariables, MilestoneMutationContext>;
  update: UseMutationResult<Milestone, Error, UpdateMilestoneVariables, MilestoneMutationContext>;
}

export function useMilestoneMutations(boardId: string): MilestoneMutations {
  const client = useKanbanClient();
  const queryClient = useQueryClient();
  const userId = useCurrentUserId();
  const reportFailure = useMutationFailureToast();

  const boardKey = KANBAN_QUERY_KEYS.BOARD(userId, boardId);
  const listKey = KANBAN_QUERY_KEYS.MILESTONES(userId, boardId);

  /** Ecrit le jalon serveur dans les DEUX caches. */
  function storeMilestone(milestone: Milestone): void {
    queryClient.setQueryData<BoardSnapshot>(boardKey, (current) =>
      current ? upsertMilestone(current, milestone) : current,
    );
    queryClient.setQueryData<Milestone[]>(listKey, (current) =>
      current ? upsertById(current, milestone, milestoneKey) : current,
    );
  }

  /*
   * Meme file que les mutations du contenu : un renommage de jalon et un
   * deplacement de carte ecrivent le meme instantane, ils ne doivent pas
   * prendre leur photo en meme temps.
   */
  const scope = boardMutationScope(boardId);

  /*
   * Creation SANS optimiste : le `milestoneId` est forge par le serveur, et un
   * jalon provisoire selectionne entre-temps dans une carte partirait avec un
   * identifiant que le serveur refuserait.
   */
  const create = useMutation<Milestone, Error, CreateMilestoneVariables, MilestoneMutationContext>({
    scope,
    mutationFn: (variables) => requestCreateMilestone(client, { boardId, ...variables }),
    onSuccess: (milestone) => storeMilestone(milestone),
    onError: (error) => reportFailure(error),
  });

  const update = useMutation<Milestone, Error, UpdateMilestoneVariables, MilestoneMutationContext>({
    scope,
    mutationFn: (variables) => requestUpdateMilestone(client, { boardId, ...variables }),
    // Renommer ou clore se voit au clic, pas a la reponse.
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: boardKey });
      await queryClient.cancelQueries({ queryKey: listKey });
      const previous = queryClient.getQueryData<BoardSnapshot>(boardKey);
      const previousList = queryClient.getQueryData<Milestone[]>(listKey);
      const { milestoneId, ...patch } = variables;
      const apply = (milestone: Milestone): Milestone =>
        milestone.milestoneId === milestoneId ? applyMilestoneChanges(milestone, patch) : milestone;

      let optimistic: BoardSnapshot | undefined;
      const current = previous?.milestones.find((entry) => entry.milestoneId === milestoneId);
      if (previous && current) {
        optimistic = writeOptimisticSnapshot(queryClient, boardKey, upsertMilestone(previous, apply(current)));
      }
      if (previousList) queryClient.setQueryData<Milestone[]>(listKey, previousList.map(apply));
      return { previous, optimistic, previousList };
    },
    onSuccess: (milestone) => storeMilestone(milestone),
    onError: (error, _variables, context) => {
      // Meme discipline que les autres mutations du tableau : la photo n'est
      // reposee que si personne n'a ecrit l'instantane depuis. La liste
      // dediee, elle, n'a pas d'autre ecrivain que cette boite : on la repose.
      rollbackBoardSnapshot(queryClient, boardKey, context);
      if (context?.previousList) queryClient.setQueryData<Milestone[]>(listKey, context.previousList);
      reportFailure(error);
    },
  });

  return { create, update };
}
