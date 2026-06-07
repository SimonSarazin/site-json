import { useQuery } from "@tanstack/react-query";
import { useCocolight } from "@/hooks/useCocolight";
import { COFORM_QUERY_KEYS } from "../constants/queryKeys";
import type { MultiEvalDataResponse } from "../types";

interface UseMultiEvalDataOptions {
  /** ID Mongo de la réponse (multi-contributeurs). */
  answerId: string | null | undefined;
  /** Optionnel : limiter aux datasets d'une step. Sinon retourne toutes les steps avec multi-eval. */
  stepKey?: string | null;
  /** Si false, ne lance pas la query (utile pour différer au mount du modal). */
  enabled?: boolean;
}

interface UseMultiEvalDataReturn {
  data: MultiEvalDataResponse | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Récupère les datasets agrégés des évaluations multiples (radar) pour une
 * réponse coform. Appelé par `MultiEvalChartDialog` au clic du bouton "Voir
 * les évaluations" placé dans le header de chaque step.
 *
 * Auth côté serveur : owner OU canAdminAnswer. Si refusé, la query échoue —
 * le dialog gère le fallback (affichage d'un message d'erreur).
 */
export function useMultiEvalData({
  answerId,
  stepKey,
  enabled = true,
}: UseMultiEvalDataOptions): UseMultiEvalDataReturn {
  const { api, loading } = useCocolight();
  const isReady = !loading && !!api && !!answerId;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: COFORM_QUERY_KEYS.MULTIEVAL_DATA(answerId ?? null, stepKey ?? null),
    queryFn: async () => {
      if (!api) throw new Error("API non initialisée");
      if (!answerId) throw new Error("answerId requis");

      // Pattern entity : `Answer.getMultiEvalData()` wrap l'endpoint
      // (callIsConnected + extraction `.data.steps`).
      const answer = await api.answer({ id: answerId });
      const data = await answer.getMultiEvalData({ stepKey });
      return data as MultiEvalDataResponse;
    },
    enabled: enabled && isReady,
    // Les datasets ne changent qu'à un save d'une réponse multi-eval — un peu
    // de stale-time est OK pour ne pas re-fetch à chaque ouverture du dialog
    // dans la même session.
    staleTime: 30 * 1000,
  });

  return {
    data: data ?? null,
    isLoading,
    error: error as Error | null,
    refetch,
  };
}
