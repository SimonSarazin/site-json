import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCocolight } from "@/hooks/useCocolight";
import { useDocumentHidden } from "@/hooks/useReducedMotion";
import { CAGNOTTE_QUERY_KEYS } from "@/modules/cagnotte/constants/queryKeys";
import { useFundingEnvelopeAction } from "@/modules/cagnotte/hooks/useFundingEnvelopeAction";
import { usePledgeRetractionEnabled } from "@/modules/cagnotte/hooks/usePledgeRetractionEnabled";
import { onPledgeChange } from "@/modules/cagnotte/utils/pledgeChanges";
import { getPledgeHolder } from "@/modules/cagnotte/utils/pledgeHolder";

export const PLEDGES_IN_PROGRESS_INTERVAL_MS = 60_000;
export const PLEDGES_IN_PROGRESS_ERROR_INTERVAL_MS = 5 * 60_000;
/** Au retour sur l'onglet, une lecture plus récente que ce délai n'est pas refaite. */
export const PLEDGES_IN_PROGRESS_STALE_MS = 10_000;

/** Réponse de `pledgesInProgress`, de même forme que l'enveloppe : les lecteurs de `utils/pledgeRetraction` la lisent. */
export interface PledgesInProgressData {
  paymentsInProgress: unknown;
}

/** Rythme de relecture : aucun minuteur page masquée, 5 min après une lecture en échec, sinon 60 s. */
export function pledgesInProgressInterval(visible: boolean, failed: boolean): number | false {
  if (!visible) return false;
  return failed ? PLEDGES_IN_PROGRESS_ERROR_INTERVAL_MS : PLEDGES_IN_PROGRESS_INTERVAL_MS;
}

/**
 * Paiements en cours de ces réponses (`pledgesInProgress`), clé `pledgeRetraction` et utilisateur connecté requis.
 * Relus selon `pledgesInProgressInterval`, au retour sur l'onglet et sur signal d'un autre onglet, sans retry.
 * `subscribeOnly` lit le cache sans appel. `undefined` sans réponse ou relecture coupée : l'appelant lit l'enveloppe.
 */
export function usePledgesInProgress(
  answerIds: readonly string[],
  { enabled = true, subscribeOnly = false }: { enabled?: boolean; subscribeOnly?: boolean } = {},
): PledgesInProgressData | undefined {
  const retractionEnabled = usePledgeRetractionEnabled();
  const { me } = useCocolight();
  const submit = useFundingEnvelopeAction();
  const queryClient = useQueryClient();
  const visible = !useDocumentHidden();
  const userId = me?.id ?? null;
  const idsKey = [...new Set(answerIds.filter(Boolean))].sort().join(",");
  const ids = useMemo(() => (idsKey === "" ? [] : idsKey.split(",")), [idsKey]);
  const active = !subscribeOnly && enabled && retractionEnabled && !!userId && ids.length > 0 && typeof window !== "undefined";

  const { data } = useQuery({
    queryKey: CAGNOTTE_QUERY_KEYS.PLEDGES_IN_PROGRESS(ids, userId),
    queryFn: async (): Promise<PledgesInProgressData> => {
      const response = await submit("pledgesInProgress", { answerIds: ids, holder: getPledgeHolder() });
      return { paymentsInProgress: response.paymentsInProgress ?? {} };
    },
    enabled: active,
    refetchInterval: (query) => pledgesInProgressInterval(visible, query.state.status === "error"),
    refetchOnWindowFocus: true,
    staleTime: PLEDGES_IN_PROGRESS_STALE_MS,
    retry: false,
  });

  // Un autre onglet a changé une réservation : relecture tout de suite page visible, sinon au retour.
  useEffect(() => {
    if (!active) return;
    return onPledgeChange(() => {
      void queryClient.invalidateQueries({
        queryKey: CAGNOTTE_QUERY_KEYS.PLEDGES_IN_PROGRESS(ids, userId),
        exact: true,
        refetchType: document.hidden ? "none" : "active",
      });
    });
  }, [active, queryClient, ids, userId]);

  return retractionEnabled && ids.length > 0 && (subscribeOnly || enabled) ? data : undefined;
}
