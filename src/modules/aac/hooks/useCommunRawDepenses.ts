import { useQuery } from "@tanstack/react-query";
import { useCocolight } from "@/hooks/useCocolight";
import { asRecord, toArrayOrValues, type UnknownRecord } from "@/modules/cagnotte/utils/dataTransform";
import { DEFAULT_AAC_STEP } from "@/modules/cagnotte/lib/actionMilestonePathUpdates";

export const COMMUN_RAW_DEPENSES_QUERY_KEY = "aac-milestone-list-depenses";

/**
 * Lit `answers.<step>.depense` d'une réponse, **tel que le document le porte**.
 */
async function fetchRawDepenses(
  api: NonNullable<ReturnType<typeof useCocolight>["api"]>,
  answerId: string,
  step: string,
): Promise<unknown> {
  const answer = await api.answer({ id: answerId });
  return asRecord(asRecord(asRecord(answer.serverData).answers)[step]).depense ?? null;
}

/**
 * Les dépenses **pour l'affichage** : toujours une liste, objet coercé compris.
 *
 * `step` par défaut `aapStep1` : hypothèse module-wide du module AAC (cf.
 * `DEFAULT_AAC_STEP`), conservée pour les appelants historiques.
 */
export function useCommunRawDepenses(answerId?: string, step: string = DEFAULT_AAC_STEP) {
  const { api } = useCocolight();

  return useQuery({
    queryKey: [COMMUN_RAW_DEPENSES_QUERY_KEY, answerId, step],
    enabled: !!api && !!answerId,
    queryFn: () => fetchRawDepenses(api!, answerId!, step),
    select: (raw: unknown): UnknownRecord[] => toArrayOrValues<UnknownRecord>(raw).map(asRecord),
  });
}

export function useCommunRawDepensesDocument(answerId?: string, step: string = DEFAULT_AAC_STEP) {
  const { api } = useCocolight();

  return useQuery({
    queryKey: [COMMUN_RAW_DEPENSES_QUERY_KEY, answerId, step],
    enabled: !!api && !!answerId,
    queryFn: () => fetchRawDepenses(api!, answerId!, step),
  });
}
