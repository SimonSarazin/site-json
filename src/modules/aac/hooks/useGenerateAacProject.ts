/**
 * Mutation : génère un Project + Room à partir d'un commun AAC
 * (`Answer.generateProject()`, SDK). Génération **irréversible**
 * — l'appelant doit confirmer avant de déclencher.
 */
import type { Api, GenerateProjectResult } from "@communecter/cocolight-api-client";
import { useMutationWithToast } from "@/hooks/useMutationWithToast";
import { useT } from "@/hooks/useT";
import { CAGNOTTE_QUERY_KEYS } from "@/modules/cagnotte/constants/queryKeys";
import { AAC_QUERY_KEYS } from "@/modules/aac/constants/queryKeys";
import { COMMUN_RAW_DEPENSES_QUERY_KEY } from "@/modules/aac/hooks/useCommunRawDepenses";

export function useGenerateAacProject(opts: {
  api: Api | null;
  answerId: string | null;
  parentId: string | null;
  parentType: string | null;
}) {
  // `showErrorToast` place `error.message` tel quel en description du toast :
  // tout message levé ici doit donc être DÉJÀ traduit.
  const t = useT("modules/aac");

  return useMutationWithToast<GenerateProjectResult, void>({
    mutationFn: async () => {
      if (!opts.api || !opts.answerId || !opts.parentId || !opts.parentType) {
        throw new Error(String(t("detail.project.toasts.incompleteContext")));
      }
      const answer = await opts.api.answer({ id: opts.answerId });
      return answer.generateProject({ parentId: opts.parentId, parentType: opts.parentType });
    },
    successKey: "detail.project.toasts.generateSuccess",
    errorKey: "detail.project.toasts.generateError",
    invalidateQueries: [
      CAGNOTTE_QUERY_KEYS.FUNDING_ENVELOPE_PREFIX(),
      CAGNOTTE_QUERY_KEYS.ORGANIZATION_PROJECTS_WITH_ANSWERS_PREFIX(),
      AAC_QUERY_KEYS.COMMUNS_PREFIX(),
      AAC_QUERY_KEYS.FACETS_PREFIX(),
      [COMMUN_RAW_DEPENSES_QUERY_KEY, opts.answerId],
    ],
    namespace: "modules/aac",
  });
}
