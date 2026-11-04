/**
 * Retrait d'une promesse par `answer.deleteFinancer`, ligne visée par sa `finkey`, jamais par sa position. Les caches
 * du financement sont relus après chaque tentative, refus compris : un refus signale des données périmées.
 */
import { useCallback } from "react";
import { useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { toast } from "sonner";
import { useCocolight } from "@/hooks/useCocolight";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { showSuccessToast } from "@/lib/toastUtils";
import { CAGNOTTE_QUERY_KEYS } from "@/modules/cagnotte/constants/queryKeys";
import { notifyPledgeChange } from "@/modules/cagnotte/utils/pledgeChanges";
import { retractErrorKind } from "@/modules/cagnotte/utils/pledgeRetraction";

export interface RetractPledgeTarget {
  answerId: string;
  /** Clé de la dépense dans le document. */
  depenseKey: string;
  financerId: string;
  finkey: string;
}

interface UseRetractPledgeOptions {
  /** Caches propres à l'hôte, relus avec ceux du financement. */
  extraInvalidate?: readonly QueryKey[];
  onRetracted?: (target: RetractPledgeTarget) => void;
}

/** Retraits en cours, toutes instances confondues : un second clic sur la même promesse est ignoré. */
const inFlightFinkeys = new Set<string>();

export function useRetractPledge({ extraInvalidate = [], onRetracted }: UseRetractPledgeOptions = {}) {
  useLoadNamespace("modules/cagnotte");
  const t = useT("modules/cagnotte");
  const { api } = useCocolight();
  const queryClient = useQueryClient();

  const mutation = useMutation<void, Error, RetractPledgeTarget>({
    mutationFn: async (target) => {
      if (!api) throw new Error(String(t("toasts.errors.noApiClient")));
      const answer = await api.answer({ id: target.answerId });
      await answer.deleteFinancer({
        depenseKey: target.depenseKey,
        financerId: target.financerId,
        finkey: target.finkey,
      });
    },
    onSuccess: (_data, target) => {
      showSuccessToast("PledgeRetract.toasts.success", t);
      notifyPledgeChange();
      onRetracted?.(target);
    },
    onError: (error) => {
      toast.error(String(t("PledgeRetract.toasts.errorTitle")), {
        description: String(t(`PledgeRetract.errors.${retractErrorKind(error)}`)),
      });
    },
    onSettled: (_data, _error, target) => {
      inFlightFinkeys.delete(target.finkey);
      const keys: QueryKey[] = [
        CAGNOTTE_QUERY_KEYS.FUNDING_ENVELOPE_PREFIX(),
        CAGNOTTE_QUERY_KEYS.ORGANIZATION_PROJECTS_WITH_ANSWERS_PREFIX(),
        CAGNOTTE_QUERY_KEYS.PROJECT_MODAL_CAGNOTTE_PREFIX(),
        CAGNOTTE_QUERY_KEYS.COMMUN_RAW_DEPENSES_PREFIX(target.answerId),
        CAGNOTTE_QUERY_KEYS.PLEDGES_IN_PROGRESS_PREFIX(),
        ...extraInvalidate,
      ];
      keys.forEach((queryKey) => void queryClient.invalidateQueries({ queryKey }));
    },
  });

  const { mutateAsync } = mutation;
  /** Rend `true` si la promesse a été retirée. */
  const retract = useCallback(
    async (target: RetractPledgeTarget): Promise<boolean> => {
      if (inFlightFinkeys.has(target.finkey)) return false;
      inFlightFinkeys.add(target.finkey);
      try {
        await mutateAsync(target);
        return true;
      } catch {
        return false;
      }
    },
    [mutateAsync],
  );

  return { retract, isPending: mutation.isPending };
}
