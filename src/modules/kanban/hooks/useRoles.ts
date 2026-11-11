/**
 * Roles d'un element Communecter vus par son board-lien (`role/*`, §12.3).
 *
 * UN cache (`ROLES`), distinct de l'instantane du tableau : les roles ne sont
 * pas des donnees du tableau mais de la PLATEFORME (`roles` de l'element, liens
 * des membres), lues cote membre (D28). Les mutations ecrivent ce cache en
 * OPTIMISTE (le glisser d'un membre vers une colonne se voit au depot), le
 * reposent au refus — a TEMOIN, comme toutes les mutations du depot
 * (`decideRollback`) —, et l'INVALIDENT a leur reglement : la liste servie fait
 * autorite, et un `role.updated` d'un autre client (ou un `full`) l'invalide
 * aussi, par le polling (`useBoardSync`, D30).
 */
import { useRef } from 'react';
import { useMutation, useQuery, useQueryClient, type UseMutationResult, type UseQueryResult } from '@tanstack/react-query';
import {
  assignRole as requestAssignRole,
  createRole as requestCreateRole,
  deleteRole as requestDeleteRole,
  listRoles,
  unassignRole as requestUnassignRole,
  type RoleMemberInput,
  type RoleNameInput,
} from '@/modules/kanban/api/roles';
import { useCurrentUserId, useKanbanClient } from '@/modules/kanban/hooks/useKanbanSession';
import { useMutationFailureToast, writeOptimisticSnapshot } from '@/modules/kanban/hooks/mutationFeedback';
import { decideRollback, type RollbackWitness } from '@/modules/kanban/lib/boardSync';
import { KANBAN_QUERY_KEYS } from '@/modules/kanban/constants/queryKeys';
import {
  applyRoleWrite,
  assignRoleLocally,
  createRoleLocally,
  deleteRoleLocally,
  unassignRoleLocally,
  withRolesRev,
} from '@/modules/kanban/lib/roles';
import type { RoleCreateResult, RoleDeleteResult, RoleListResult, RoleWriteResult } from '@/modules/kanban/types';
import { shouldRetryKanbanQuery } from '@/modules/kanban/lib/kanbanErrors';

export interface UseRolesOptions {
  /** Ne charge qu'une vue qui en a besoin (vue Roles, boite « Roles… » d'un membre). */
  enabled?: boolean;
}

export function useRoles(boardId: string, options: UseRolesOptions = {}): UseQueryResult<RoleListResult, Error> {
  const client = useKanbanClient();
  const userId = useCurrentUserId();

  return useQuery({
    queryKey: KANBAN_QUERY_KEYS.ROLES(userId, boardId),
    queryFn: ({ signal }) => listRoles(client, boardId, { signal }),
    retry: shouldRetryKanbanQuery,
    enabled: userId !== null && boardId.length > 0 && (options.enabled ?? true),
  });
}

export type AssignRoleVariables = Omit<RoleMemberInput, 'boardId'>;
export type RoleNameVariables = Omit<RoleNameInput, 'boardId'>;

/**
 * Ce que `onMutate` retient : la photo d'AVANT et la liste optimiste REELLEMENT
 * stockee (le temoin) — la meme paire que les mutations du tableau.
 */
export type RoleMutationContext = RollbackWitness<RoleListResult>;

export interface RoleMutations {
  assign: UseMutationResult<RoleWriteResult, Error, AssignRoleVariables, RoleMutationContext>;
  unassign: UseMutationResult<RoleWriteResult, Error, AssignRoleVariables, RoleMutationContext>;
  create: UseMutationResult<RoleCreateResult, Error, RoleNameVariables, RoleMutationContext>;
  remove: UseMutationResult<RoleDeleteResult, Error, RoleNameVariables, RoleMutationContext>;
}

/**
 * File des APPELS RESEAU des ecritures de roles d'un tableau. TanStack Query
 * n'execute l'une apres l'autre que les `mutationFn` qui partagent ce `scope` ;
 * les `onMutate`, eux, partent tous tout de suite (query-core 5.103,
 * `Mutation.execute` : `onMutate` est attendu AVANT `retryer.start()`, et seul
 * le retryer consulte `canRun`). La file garantit donc l'ORDRE des ecritures
 * sur le serveur — deux depots rapides sur le meme membre ne se croisent pas —,
 * pas la coherence des photos optimistes, qui est l'affaire de la CHAINE de
 * `useRoleMutations`. File DISTINCTE de celle du tableau : un role et une carte
 * n'ecrivent pas le meme cache, les serialiser ensemble ne protegerait rien.
 */
function roleMutationScope(boardId: string): { id: string } {
  return { id: `roles-${boardId}` };
}

/**
 * Ecritures EN VOL sur la liste des roles d'un tableau, et la photo d'AVANT LA
 * PREMIERE d'entre elles.
 *
 * Deux depots rapides prennent chacun leur photo tout de suite (cf.
 * `roleMutationScope`) : la photo du second est deja la liste optimiste du
 * premier. La reposer au refus du second RESSUSCITAIT le role que le premier
 * venait de voir refuser, jusqu'a la relecture. Tant qu'une ecriture est en
 * vol, c'est donc la photo d'avant la chaine que chaque `onMutate` retient.
 */
interface InFlightChain {
  inFlight: number;
  previous: RoleListResult | undefined;
}

export function useRoleMutations(boardId: string): RoleMutations {
  const client = useKanbanClient();
  const queryClient = useQueryClient();
  const userId = useCurrentUserId();
  const reportFailure = useMutationFailureToast();
  const queryKey = KANBAN_QUERY_KEYS.ROLES(userId, boardId);
  const scope = roleMutationScope(boardId);
  const chain = useRef<InFlightChain>({ inFlight: 0, previous: undefined });

  /** Ecrit la liste optimiste ; rend la photo d'avant la chaine et le temoin (reference stockee). */
  async function takeSnapshot(update: (current: RoleListResult) => RoleListResult): Promise<RoleMutationContext> {
    // Une relecture `role/list` en vol ecraserait l'etat optimiste des qu'elle
    // repondrait : on l'annule avant de toucher au cache.
    await queryClient.cancelQueries({ queryKey });
    const current = queryClient.getQueryData<RoleListResult>(queryKey);
    if (chain.current.inFlight === 0) chain.current.previous = current;
    chain.current.inFlight += 1;
    if (!current) return { previous: chain.current.previous };
    return { previous: chain.current.previous, optimistic: writeOptimisticSnapshot(queryClient, queryKey, update(current)) };
  }

  /**
   * Refus : la photo d'avant n'est reposee que si le cache porte encore
   * EXACTEMENT la liste optimiste de cette ecriture (`decideRollback`, meme
   * regle que le tableau). Sinon une autre ecriture est passee — reponse d'un
   * depot plus ancien de la chaine, relecture — et reposer la photo
   * l'ecraserait : on ne touche a rien, `settle` relit. (Pas d'invalidation
   * ici : une seconde invalidation annulerait la premiere en vol,
   * `cancelRefetch`, et doublerait l'appel.) La raison est notifiee.
   */
  function rollback(error: unknown, context: RoleMutationContext | undefined): void {
    if (decideRollback(queryClient.getQueryData<RoleListResult>(queryKey), context) === 'restore') {
      queryClient.setQueryData<RoleListResult>(queryKey, context?.previous);
    }
    reportFailure(error);
  }

  /**
   * Reglement, succes ou refus : la liste servie fait autorite (D30) — un autre
   * client a pu ecrire entre-temps, ou le refus dit que le membre n'est plus lie
   * (404 `notLinked`), et seule la liste servie dit alors la verite. La chaine
   * se vide d'une ecriture ; vide, elle oublie sa photo.
   */
  function settle(): void {
    chain.current.inFlight = Math.max(0, chain.current.inFlight - 1);
    if (chain.current.inFlight === 0) chain.current.previous = undefined;
    void queryClient.invalidateQueries({ queryKey });
  }

  /** La reponse d'une ecriture est posee sur la liste : liste du membre (D29) et revision. */
  function applyWrite(result: RoleWriteResult): void {
    queryClient.setQueryData<RoleListResult>(queryKey, (current) => (current ? applyRoleWrite(current, result) : current));
  }

  /**
   * Revision de la reponse posee sur la liste : le polling saura que cette
   * ecriture est deja dans la liste et ne la relira pas une seconde fois
   * (`rolesRereadNeeded`). `assign` et `unassign` la posent par `applyRoleWrite`.
   */
  function applyRev(result: { rev: number }): void {
    queryClient.setQueryData<RoleListResult>(queryKey, (current) => (current ? withRolesRev(current, result.rev) : current));
  }

  const assign = useMutation<RoleWriteResult, Error, AssignRoleVariables, RoleMutationContext>({
    scope,
    mutationFn: (variables) => requestAssignRole(client, { boardId, ...variables }),
    onMutate: (variables) =>
      takeSnapshot((current) => assignRoleLocally(current, { id: variables.memberId, type: variables.memberType }, variables.role)),
    onSuccess: applyWrite,
    onError: (error, _variables, context) => rollback(error, context),
    onSettled: settle,
  });

  const unassign = useMutation<RoleWriteResult, Error, AssignRoleVariables, RoleMutationContext>({
    scope,
    mutationFn: (variables) => requestUnassignRole(client, { boardId, ...variables }),
    onMutate: (variables) =>
      takeSnapshot((current) => unassignRoleLocally(current, { id: variables.memberId, type: variables.memberType }, variables.role)),
    onSuccess: applyWrite,
    onError: (error, _variables, context) => rollback(error, context),
    onSettled: settle,
  });

  const create = useMutation<RoleCreateResult, Error, RoleNameVariables, RoleMutationContext>({
    scope,
    mutationFn: (variables) => requestCreateRole(client, { boardId, ...variables }),
    onMutate: (variables) => takeSnapshot((current) => createRoleLocally(current, variables.role)),
    onSuccess: applyRev,
    onError: (error, _variables, context) => rollback(error, context),
    onSettled: settle,
  });

  const remove = useMutation<RoleDeleteResult, Error, RoleNameVariables, RoleMutationContext>({
    scope,
    mutationFn: (variables) => requestDeleteRole(client, { boardId, ...variables }),
    onMutate: (variables) => takeSnapshot((current) => deleteRoleLocally(current, variables.role)),
    onSuccess: applyRev,
    onError: (error, _variables, context) => rollback(error, context),
    onSettled: settle,
  });

  return { assign, unassign, create, remove };
}
