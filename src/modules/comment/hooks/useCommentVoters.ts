import { useQuery } from "@tanstack/react-query";
import type { Comment } from "@communecter/cocolight-api-client";
import { useHydratedUserContextId } from "@/hooks/useHydratedUserContextId";
import { COMMENT_QUERY_KEYS } from "../constants/queryKeys";
import { toVotersData, type VotersData } from "../lib/voters";

export interface UseCommentVotersOptions {
  readonly commentId: string | null;
  /** L'instance SDK du message, prise dans l'index du fil. */
  readonly instance?: Comment | null;
  /** `false` tant que la liste n'est pas demandée — elle ne se charge qu'à l'ouverture. */
  readonly enabled?: boolean;
}

/**
 * Qui a réagi à un message, et comment.
 *
 * La requête n'est jamais lancée d'office : une page portant trente messages déclencherait
 * trente appels pour une information que personne n'a demandée. Elle se déclenche à
 * l'ouverture de la liste des votants, et se périme dès qu'on réagit soi-même
 * (`useCommentMutations` invalide `VOTERS_PREFIX`).
 */
export function useCommentVoters({ commentId, instance, enabled = false }: UseCommentVotersOptions) {
  const userContextId = useHydratedUserContextId();

  const query = useQuery({
    queryKey: COMMENT_QUERY_KEYS.VOTERS(commentId ?? "none", userContextId),
    enabled: enabled && Boolean(commentId) && Boolean(instance),
    staleTime: 30_000,
    queryFn: async (): Promise<VotersData> => {
      if (!instance) throw new Error("Message introuvable dans le fil chargé.");
      return toVotersData(await instance.getVotes());
    },
  });

  return {
    ...query,
    voters: query.data?.voters ?? [],
    counts: query.data?.counts ?? {},
  };
}
