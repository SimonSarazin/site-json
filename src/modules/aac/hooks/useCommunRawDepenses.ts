import { useQuery } from "@tanstack/react-query";
import { useCocolight } from "@/hooks/useCocolight";
import { asRecord, toArrayOrValues, type UnknownRecord } from "@/modules/cagnotte/utils/dataTransform";

export const COMMUN_RAW_DEPENSES_QUERY_KEY = "aac-milestone-list-depenses";

/**
 * Lit `answers.<step>.depense[]` d'une réponse.
 *
 * `step` par défaut `aapStep1` : hypothèse module-wide du module AAC (cf.
 * `DEFAULT_AAC_STEP`), conservée pour les appelants historiques.
 */
export function useCommunRawDepenses(answerId?: string, step: string = "aapStep1") {
  const { api } = useCocolight();

  return useQuery<UnknownRecord[]>({
    queryKey: [COMMUN_RAW_DEPENSES_QUERY_KEY, answerId, step],
    enabled: !!api && !!answerId,
    queryFn: async () => {
      const answer = await api!.answer({ id: answerId! });
      const raw = asRecord(asRecord(asRecord(answer.serverData).answers)[step]).depense;
      return toArrayOrValues<UnknownRecord>(raw).map(asRecord);
    },
  });
}
