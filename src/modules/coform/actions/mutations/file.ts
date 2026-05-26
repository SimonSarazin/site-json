/**
 * Mutation de soumission finale d'un formulaire CoForm.
 *
 * Délégation au pipeline lib (`Answer.processUploads` + `Answer.save`).
 * Toute l'orchestration upload-batching-normalisation-clean-save vit côté
 * `@communecter/cocolight-api-client` (≥ 1.0.134).
 *
 * Avant : ~242 lignes d'orchestration manuelle (collecte data:URI, premier
 * upload séparé, batching, normalisation legacy uploader, clean URLs, save).
 * Après : 1 appel `processUploads` + `save`.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCocolight } from "@/hooks/useCocolight";
import { COFORM_QUERY_KEYS } from "../../constants";
import type { AllStepsData } from "../../types";

export interface UseCoFormFinalMutationOptions {
  formId: string;
  answerId?: string | null;
  onSuccess?: (data: unknown) => void;
  onError?: (error: Error) => void;
}

export interface CoFormFinalMutationData {
  allData: AllStepsData;
  addedOptions?: Record<string, Record<string, string[]>>;
  /** Liens à ajouter dans answer.links (éléments Finder sélectionnés) */
  links?: Record<string, Record<string, { name: string; type: string }>>;
}

/**
 * Hook pour soumettre le formulaire complet via la lib entité.
 * Supporte la création (nouvelle réponse) et la mise à jour (answerId fourni).
 */
export function useCoFormFinalMutation({
  formId,
  answerId,
  onSuccess,
  onError,
}: UseCoFormFinalMutationOptions) {
  const { api } = useCocolight();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ allData, addedOptions, links }: CoFormFinalMutationData) => {
      if (!api) throw new Error("API non initialisée");

      // 1. Charger le Form (parent costum) puis créer/fetch l'Answer.
      // TODO: éviter le double-fetch quand le Form est déjà dans le cache RQ.
      const form = await api.form({ id: formId });
      const answer = answerId
        ? await form.answer({ id: answerId })
        : await form.answer();

      // 2. Pipeline upload complet (data:URI → docPath, batching, normalisation
      //    legacy uploader, clean URLs absolues) en UNE ligne.
      const prepared = await answer.processUploads(
        allData as Record<string, Record<string, unknown>>,
      );

      // 3. Affecter les données préparées + champs annexes sur le draft.
      answer.data.answers = prepared;
      if (addedOptions && Object.keys(addedOptions).length > 0) {
        answer.data.addedOptions = addedOptions;
      }
      if (links && Object.keys(links).length > 0) {
        answer.data.links = links;
      }

      // 4. Save (POST SAVE_COFORM_ANSWER + refresh automatique avec
      //    canEdit/editDeniedReason calculés backend).
      await answer.save();
      return answer.serverData;
    },
    onSuccess: (data) => {
      // Invalider les caches : formulaire (pour rafraîchir l'access) + réponses
      queryClient.invalidateQueries({ queryKey: COFORM_QUERY_KEYS.FORM(formId) });
      queryClient.invalidateQueries({ queryKey: COFORM_QUERY_KEYS.FORM_ANSWERS(formId) });
      onSuccess?.(data);
    },
    onError: (error: Error) => {
      onError?.(error);
    },
  });
}
