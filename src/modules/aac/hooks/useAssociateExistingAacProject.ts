/**
 * Mutation : associe un commun AAC à un projet EXISTANT (alternative à
 * `useGenerateAacProject`, qui en crée un nouveau)
 */
import type { Api, Organization, Project } from "@communecter/cocolight-api-client";
import { useMutationWithToast } from "@/hooks/useMutationWithToast";
import { CAGNOTTE_QUERY_KEYS } from "@/modules/cagnotte/constants/queryKeys";
import { AAC_QUERY_KEYS } from "@/modules/aac/constants/queryKeys";
import { COMMUN_RAW_DEPENSES_QUERY_KEY } from "@/modules/aac/hooks/useCommunRawDepenses";
import {
  associateExistingProject,
  type AssociateExistingProjectResult,
} from "@/modules/aac/lib/associateExistingProject";

export function useAssociateExistingAacProject(opts: {
  api: Api | null;
  answerId: string | null;
  userId: string | null;
  /**
   * Hôte du costum (`useCocolight().entity`) — passé à `associateExistingProject`
   * pour la double vérif « ce projet n'est-il pas déjà le projet d'un autre
   * commun » (contrôle via `coformAnswersSearch`, scopé costum).
   */
  context?: Organization | Project | null;
}) {
  return useMutationWithToast<AssociateExistingProjectResult, { projectId: string }>({
    mutationFn: async ({ projectId }) => {
      if (!opts.api || !opts.answerId || !opts.userId) {
        throw new Error("Contexte incomplet pour associer un projet existant.");
      }
      const [answer, project] = await Promise.all([
        opts.api.answer({ id: opts.answerId }),
        opts.api.project({ id: projectId }),
      ]);
      return associateExistingProject({ answer, project, userId: opts.userId, context: opts.context ?? null });
    },
    successKey: "detail.project.toasts.associateSuccess",
    errorKey: "detail.project.toasts.associateError",
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
