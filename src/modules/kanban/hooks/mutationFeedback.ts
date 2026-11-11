/**
 * Retour d'ECHEC des mutations d'un tableau — factorise (bonnes pratiques §13).
 *
 * Trois hooks ecrivent le cache d'un tableau (`useBoardMutations`,
 * `useMilestones`, `useCardComments`) et partagent trois
 * gestes, autrefois recopies dans chacun : la FILE de serialisation, le
 * ROLLBACK conditionnel de l'instantane, et la NOTIFICATION d'echec. Une
 * evolution du retour d'erreur (une raison qui cite des nombres, un bouton
 * « Reessayer ») se fait desormais a un seul endroit.
 */
import type { QueryClient, QueryKey } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { decideRollback, type RollbackDecision, type RollbackWitness } from '@/modules/kanban/lib/boardSync';
import { kanbanErrorText } from '@/modules/kanban/lib/kanbanErrors';
import type { BoardSnapshot } from '@/modules/kanban/types';

/**
 * File des ecritures d'un tableau : TanStack Query execute L'UNE APRES L'AUTRE
 * les mutations qui partagent ce `scope`. Deux mutations en parallele
 * prendraient leur photo sur le meme instantane, et la seconde ecraserait la
 * premiere au moindre echec. La file est par tableau : deux tableaux restent
 * independants. Une seule definition, parce que la serialisation repose sur
 * l'EGALITE de ces chaines entre les hooks.
 */
export function boardMutationScope(boardId: string): { id: string } {
  return { id: `board-${boardId}` };
}

/**
 * Ecrit la valeur OPTIMISTE d'un cache et renvoie la reference REELLEMENT
 * stockee — le temoin a garder pour `rollbackBoardSnapshot` (ou pour
 * `decideRollback`, quand le hook execute lui-meme l'effet).
 *
 * TanStack Query partage la structure (`structuralSharing`) : quand le cache
 * porte deja une valeur, il stocke une COPIE fusionnee, pas l'objet passe.
 * Garder l'objet passe comme temoin faisait echouer la comparaison d'identite a
 * chaque fois : le rollback invalidait (un `board/get` complet) au lieu de
 * reposer la photo d'avant, meme quand rien d'autre n'avait ecrit.
 *
 * Generique (`BoardSnapshot` par defaut) : la liste des roles (§12) suit la
 * meme regle sans la recopier.
 */
export function writeOptimisticSnapshot<T = BoardSnapshot>(
  queryClient: QueryClient,
  queryKey: QueryKey,
  snapshot: T,
): T | undefined {
  queryClient.setQueryData<T>(queryKey, snapshot);
  return queryClient.getQueryData<T>(queryKey);
}

/**
 * Defait une mutation ratee SANS ecraser les ecritures confirmees depuis.
 *
 * La DECISION est prise par `decideRollback` (pure et testee) ; on n'en
 * execute ici que l'effet. On ne restaure la photo d'avant que si le cache
 * porte encore EXACTEMENT l'instantane ecrit par `onMutate` (le temoin rendu
 * par `writeOptimisticSnapshot`) ; sinon une autre ecriture est passee
 * (mutation, jalon, polling) et seul `board/get` sait encore quoi afficher.
 * Renvoie la decision, pour les tests.
 */
export function rollbackBoardSnapshot<T = BoardSnapshot>(
  queryClient: QueryClient,
  queryKey: QueryKey,
  witness: RollbackWitness<T> | undefined,
): RollbackDecision {
  const decision = decideRollback(queryClient.getQueryData<T>(queryKey), witness);
  if (decision === 'restore') queryClient.setQueryData<T>(queryKey, witness?.previous);
  else if (decision === 'invalidate') void queryClient.invalidateQueries({ queryKey });
  return decision;
}

/**
 * Notification d'echec d'une mutation : titre commun, message de la RAISON du
 * refus quand le serveur en donne une (`kanbanErrorText`) — `boardArchived`,
 * `concurrentUpdate`, `contributorsLimit` avec ses bornes… —, jamais « une
 * erreur est survenue ».
 */
export function useMutationFailureToast(): (error: unknown) => void {
  const { t } = useTranslation('modules/kanban');
  return (error) =>
    toast.error(t('toast.actionFailed', { defaultValue: 'Action impossible' }), {
      description: kanbanErrorText(t, error),
    });
}
