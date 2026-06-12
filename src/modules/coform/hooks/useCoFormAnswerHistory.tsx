import { useQuery } from "@tanstack/react-query";
import { useCocolight } from "@/hooks/useCocolight";
import { COFORM_QUERY_KEYS } from "../constants/queryKeys";
import type { AnswerChange } from "../types";

interface UseCoFormAnswerHistoryOptions {
  /** ID Mongo de la réponse dont on veut l'historique. */
  answerId: string | null | undefined;
  /** Si false, ne lance pas la query (utile pour différer au mount du modal). */
  enabled?: boolean;
}

interface UseCoFormAnswerHistoryReturn {
  history: AnswerChange[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Récupère l'historique d'audit d'une réponse coform via l'endpoint
 * `GET_COFORM_ANSWER_HISTORY`. Retourne au plus 200 entrées triées du plus
 * récent au plus ancien.
 *
 * Auth côté serveur : l'user doit être propriétaire ou admin du parent du
 * form ou admin/membre du finder selon `membersCanEditSharedAnswer`. Si
 * refusé, la query échoue avec une erreur — l'UI doit gérer le fallback
 * (afficher juste les méta sans historique).
 */
export function useCoFormAnswerHistory({
  answerId,
  enabled = true,
}: UseCoFormAnswerHistoryOptions): UseCoFormAnswerHistoryReturn {
  const { api, loading } = useCocolight();
  const isReady = !loading && !!api && !!answerId;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: COFORM_QUERY_KEYS.ANSWER_HISTORY(answerId ?? null),
    queryFn: async () => {
      if (!api) throw new Error("API non initialisée");
      if (!answerId) throw new Error("answerId requis");

      // Pattern entity : `Answer.getHistory()` wrap l'endpoint
      // (callIsConnected + extraction `.data.history`).
      const answer = await api.answer({ id: answerId });
      const list = await answer.getHistory();
      return list as AnswerChange[];
    },
    enabled: enabled && isReady,
    // Pas de stale-while-revalidate : l'historique ne change que sur save,
    // et un refresh manuel est suffisant si on rouvre le dialog.
    staleTime: 60 * 1000,
  });

  return {
    history: data ?? [],
    isLoading,
    error: error as Error | null,
    refetch,
  };
}
