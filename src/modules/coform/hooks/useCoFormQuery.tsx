/**
 * Hooks de query CoForm — chargement de formulaires et de réponses.
 *
 * Le pipeline d'upload et la mutation finale (`useCoFormFinalMutation`) vivent
 * dans `../actions/mutations/file.ts` et délèguent désormais à la lib
 * (`Answer.processUploads` + `Answer.save`, cf. `@communecter/cocolight-api-client`
 * ≥ 1.0.134). Les anciens helpers `uploadHelpers.ts` ont été supprimés au
 * Module 2 du refactor — toute la logique upload-batching-normalisation est
 * centralisée côté lib.
 *
 * Ce fichier conserve :
 *  - `useCoFormQuery` : charge la structure d'un formulaire.
 *  - `useCoFormStepMutation` (`@unused`) : conservé pour usage futur prévu.
 *  - `useCoFormAnswerQuery` : charge une réponse existante par son ID.
 *
 * Re-exporte `useCoFormFinalMutation` pour préserver la compatibilité ascendante
 * avec les consommateurs (`CoFormPage`, `CoFormAnswerPage`, `SmartCoForm`).
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCocolight } from "@/hooks/useCocolight";
import { COFORM_QUERY_KEYS } from "../constants";
import type { CoFormData, CoFormAccessInfo, CoFormAnswer, SubFormData, AllStepsData } from "../types";

// Re-export du hook de soumission finale (compat ascendante).
export { useCoFormFinalMutation } from "../actions/mutations/file";
// Instruction SÉPARÉE et type-only : le plugin react-refresh ignore `export type {…}`
// mais pas les specifiers `type` d'un export mixte, où il prend les noms PascalCase
// pour des composants (4 faux positifs).
export type {
  UseCoFormFinalMutationOptions,
  CoFormFinalMutationData,
} from "../actions/mutations/file";

// ============================================================================
// useCoFormQuery — chargement de la structure d'un formulaire
// ============================================================================

interface UseCoFormQueryOptions {
  /** ID du formulaire à charger */
  formId: string;
  /** Activer/désactiver la requête */
  enabled?: boolean;
  /**
   * ID Mongo d'une entité cible (mode collaboratif "par élément") : la
   * réponse partagée portant sur cette entité est calculée côté serveur, et
   * `access` reflète les droits sur cette réponse plutôt que sur la réponse
   * personnelle du user. Requis avec `elementType`.
   */
  elementId?: string;
  /** Type de l'élément (collection MongoDB). Requis si `elementId` fourni. */
  elementType?: "organizations" | "projects" | "events" | "poi" | "citoyens";
}

interface UseCoFormQueryReturn {
  formData: CoFormData | null;
  access: CoFormAccessInfo | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
  stepsCount: number;
  isMultiStep: boolean;
}

/**
 * Hook pour charger un formulaire CoForm depuis l'API.
 * Utilise la façade `api.form({ id })` (cf. `Api.d.ts:66`).
 */
export function useCoFormQuery({
  formId,
  enabled = true,
  elementId,
  elementType,
}: UseCoFormQueryOptions): UseCoFormQueryReturn {
  const { api, loading } = useCocolight();
  const isReady = !loading && !!api;
  const hasElement = !!elementId && !!elementType;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: hasElement
      ? ([...COFORM_QUERY_KEYS.FORM(formId), "element", elementType, elementId] as const)
      : COFORM_QUERY_KEYS.FORM(formId),
    queryFn: async () => {
      if (!api) throw new Error("API non initialisée");

      // Mode "par élément" → endpointApi direct (le wrapper entity.form ne
      // propage pas les params elementId/elementType). Sinon, garde le
      // wrapper pour ne pas casser l'usage existant.
      if (hasElement) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const response = await (api.endpointApi as any).getCoformById({
          parentFormId: formId,
          elementId,
          elementType,
        });
        const raw = (response?.serverData?.data ?? response?.data) as CoFormData | undefined;
        return raw ?? null;
      }

      const form = await api.form({ id: formId });
      // `Form.serverData` est typé `FormItemNormalized` côté lib ; le type local
      // `CoFormData` diffère (sous-ensemble enrichi). Cast structurel maintenu.
      return form.serverData as unknown as CoFormData;
    },
    enabled: enabled && isReady && !!formId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const stepsCount = data?.inputs ? Object.keys(data.inputs).length : 0;
  const isMultiStep = stepsCount > 1;
  const access = data?.access ?? null;

  return {
    formData: data ?? null,
    access,
    isLoading,
    error: error as Error | null,
    refetch,
    stepsCount,
    isMultiStep,
  };
}

// ============================================================================
// useCoFormStepMutation — sauvegarde locale de cache (non-utilisée actuellement)
// ============================================================================

interface UseCoFormStepMutationOptions {
  formId: string;
  onSuccess?: (data: unknown) => void;
  onError?: (error: Error) => void;
}

interface StepSubmitData {
  subFormId: string;
  data: SubFormData;
  stepIndex: number;
}

/**
 * Hook pour soumettre les données d'une étape (placeholder — non câblé en prod).
 *
 * @future Placeholder pour la fonctionnalité "submit étape par étape" du module
 * CoForm. L'infrastructure côté `CoFormProvider` est en place :
 *  - `submitMode: "step" | "both"` route les soumissions vers `onStepSubmit`
 *  - `useCoFormStep.submitStep()` valide via Zod puis appelle `submitStepData`
 *  - `MultiStepCoForm.handleSubmit` invoque `submitStep()` à chaque "Next"
 *
 * Ce qui manque pour activer :
 *  1. Un endpoint backend dédié (ex: `SAVE_COFORM_STEP`) ou réutiliser
 *     `saveCoformAnswer` avec un payload partiel
 *  2. Câbler `onStepSubmit` dans les pages (`CoFormPage`, `CoFormAnswerPage`)
 *     en remplaçant ou complétant le `useCoFormFinalMutation` actuel
 *  3. Décider du contrat de retour (id provisoire ? validation côté serveur ?)
 *
 * Cas d'usage prévus :
 *  - Brouillons auto-sauvés à chaque "Next" (UX longue forme)
 *  - Tracking analytics par étape (drop-off rate)
 *  - Validation backend par étape (avant le submit final)
 *
 * Comportement actuel (`console.log` + `invalidateQueries`) est intentionnel :
 *  → permet de tester le câblage côté front sans backend, et de logger en dev.
 *
 * Ne pas supprimer — voir `README.md#step-mode` pour le statut produit.
 */
export function useCoFormStepMutation({ formId, onSuccess, onError }: UseCoFormStepMutationOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ subFormId, data, stepIndex }: StepSubmitData) => {
      console.log(`[CoForm] Cache étape ${stepIndex + 1}:`, { formId, subFormId, data });
      return { success: true, subFormId, data };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: COFORM_QUERY_KEYS.FORM_ANSWERS(formId) });
      onSuccess?.(data);
    },
    onError: (error: Error) => {
      onError?.(error);
    },
  });
}

// ============================================================================
// useCoFormAnswerQuery — chargement d'une réponse existante par ID
// ============================================================================

interface UseCoFormAnswerQueryOptions {
  /** ID du formulaire parent */
  formId: string;
  answerId: string;
  enabled?: boolean;
}

interface UseCoFormAnswerQueryReturn {
  /** Données complètes de la réponse */
  answer: CoFormAnswer | null;
  /** Données de réponses (answers) pour pré-remplissage */
  answerData: AllStepsData | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Hook pour charger une réponse CoForm existante par son ID.
 *
 * Délégation à la lib (1.0.134+) :
 *  - `form.answer({id})` puis `.get()` interne via `Answer.get()` qui auto-injecte
 *    `formId` depuis le parent Form.
 *  - `_transformServerData` côté lib normalise automatiquement les valeurs d'inputs
 *    `*.uploader` du format Array `[{docId, docPath}]` vers `{updateDate, files}` —
 *    plus besoin de `normalizeAnswerData` côté site-json (Round 2 P1).
 *  - `canEdit` / `editDeniedReason` sont calculés backend et présents dans
 *    `answer.serverData`.
 */
export function useCoFormAnswerQuery({
  formId,
  answerId,
  enabled = true,
}: UseCoFormAnswerQueryOptions): UseCoFormAnswerQueryReturn {
  const { api, loading, me } = useCocolight();
  const isReady = !loading && !!api;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: COFORM_QUERY_KEYS.FORM_ANSWER(formId, answerId, me?.id ?? null),
    queryFn: async () => {
      if (!api) throw new Error("API non initialisée");

      // form.answer({id}) → get() auto-injecte formId via parent ; serverData
      // contient canEdit/editDeniedReason calculés backend.
      const form = await api.form({ id: formId });
      const answer = await form.answer({ id: answerId });
      return answer.serverData as unknown as CoFormAnswer;
    },
    enabled: enabled && isReady && !!answerId,
    staleTime: 2 * 60 * 1000,
  });

  return {
    answer: data ?? null,
    answerData: (data?.answers as AllStepsData) ?? null,
    isLoading,
    error: error as Error | null,
    refetch,
  };
}
