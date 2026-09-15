import { useMutationWithToast } from "@/hooks/useMutationWithToast";
import { deleteElementById, type AnswerDeletionEndpoint } from "@/modules/coform/actions/mutations/answer";
import { AAC_QUERY_KEYS } from "../constants/queryKeys";
import { CAGNOTTE_QUERY_KEYS } from "@/modules/cagnotte/constants/queryKeys";
import type { Api } from "@communecter/cocolight-api-client";

/**
 * Suppression d'un commun, et sur demande du projet qu'il a engendré et de ses actions.
 *
 * La cascade est EXPLICITE parce que le backend n'en fait aucune : `Element::deleteSimple`
 * retire le document, ses commentaires et ses fichiers, mais ni les actions d'un projet ni les
 * liens croisés.
 */

/** Ce qui a réellement été supprimé — sert au message rendu à l'utilisateur. */
export interface CommunDeletionOutcome {
  actionsDeleted: number;
  actionsFailed: number;
  projectDeleted: boolean;
  projectFailed: boolean;
}

export interface DeleteCommunParams {
  answerId: string;
  /** Supprimer aussi le projet lié et ses actions. */
  withProject?: boolean;
  projectId?: string | null;
  actionIds?: string[];
}

const RAISON = "delete commun AAC";

/**
 * Ordre : le COMMUN d'abord — demande principale, et seul échec qui fait échouer le geste.
 * L'inverse laisserait une fiche affichant un suivi détruit, quand cet ordre-ci ne peut produire,
 * au pire, que des entités orphelines autonomes.
 *
 * Le nettoyage est best-effort et séquentiel — pas de `Promise.all` sur une API unitaire — et
 * ses échecs sont comptés, jamais avalés.
 */
export async function applyCommunDeletion(
  endpointApi: AnswerDeletionEndpoint,
  { answerId, withProject, projectId, actionIds = [] }: DeleteCommunParams
): Promise<CommunDeletionOutcome> {
  await deleteElementById(endpointApi, "answers", answerId, RAISON);

  const outcome: CommunDeletionOutcome = {
    actionsDeleted: 0,
    actionsFailed: 0,
    projectDeleted: false,
    projectFailed: false,
  };

  if (!withProject) return outcome;

  // Les actions AVANT le projet : une fois le projet parti, plus rien ne permet
  // de les retrouver pour les nettoyer.
  for (const actionId of actionIds) {
    try {
      await deleteElementById(endpointApi, "actions", actionId, RAISON);
      outcome.actionsDeleted += 1;
    } catch {
      outcome.actionsFailed += 1;
    }
  }

  if (projectId) {
    try {
      await deleteElementById(endpointApi, "projects", projectId, RAISON);
      outcome.projectDeleted = true;
    } catch {
      outcome.projectFailed = true;
    }
  }

  return outcome;
}

export interface UseDeleteCommunOptions {
  api: Api | null;
}

/**
 * Les invalidations vivent sur la MUTATION, pas dans le `onSuccess` de l'appel : une suppression
 * démonte son appelant, et React Query saute alors les callbacks par appel. Les clés cagnotte en
 * sont, dès qu'un projet peut partir — l'enveloppe et la liste des projets le portent encore.
 */
export function useDeleteCommun({ api }: UseDeleteCommunOptions) {
  return useMutationWithToast<CommunDeletionOutcome, DeleteCommunParams>({
    mutationFn: async (params) => {
      if (!api) throw new Error("API indisponible");
      return applyCommunDeletion(
        api.endpointApi as unknown as AnswerDeletionEndpoint,
        params
      );
    },
    namespace: "modules/aac",
    successKey: "delete.toasts.success",
    errorKey: "delete.toasts.error",
    invalidateQueries: [
      AAC_QUERY_KEYS.COMMUNS_PREFIX(),
      AAC_QUERY_KEYS.COUNT_PREFIX(),
      AAC_QUERY_KEYS.FACETS_PREFIX(),
      AAC_QUERY_KEYS.COMMUN_PROJECT_PREFIX(),
      CAGNOTTE_QUERY_KEYS.FUNDING_ENVELOPE_PREFIX(),
    ],
  });
}
