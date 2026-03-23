import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCocolight } from "@/hooks/useCocolight";
import { COFORM_QUERY_KEYS } from "../constants";
import type { CoFormData, CoFormAccessInfo, CoFormAnswer, SubFormData, AllStepsData } from "../types";

interface UseCoFormQueryOptions {
  /** ID du formulaire à charger */
  formId: string;
  /** Activer/désactiver la requête */
  enabled?: boolean;
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
 * Hook pour charger un formulaire CoForm depuis l'API
 * Utilise l'endpoint GET_COFORM_BY_ID créé dans cocolight-api-client
 */
export function useCoFormQuery({ formId, enabled = true }: UseCoFormQueryOptions): UseCoFormQueryReturn {
  const { api, loading } = useCocolight();
  const isReady = !loading && !!api;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: COFORM_QUERY_KEYS.form(formId),
    queryFn: async () => {
      if (!api) throw new Error("API non initialisée");
      
      // Utilise l'endpoint GET_COFORM_BY_ID
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const form = await (api as any).form({ id: formId });
      return form.serverData as unknown as CoFormData;
    },
    enabled: enabled && isReady && !!formId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Calculer le nombre d'étapes
  const stepsCount = data?.inputs ? Object.keys(data.inputs).length : 0;
  const isMultiStep = stepsCount > 1;

  // Extraire les informations d'accès
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

interface UseCoFormStepMutationOptions {
  /** ID du formulaire */
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
 * Hook pour soumettre les données d'une étape
 * Sauvegarde locale en cache — pas d'appel API intermédiaire
 */
export function useCoFormStepMutation({ formId, onSuccess, onError }: UseCoFormStepMutationOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ subFormId, data, stepIndex }: StepSubmitData) => {
      // Sauvegarde en cache local (pas de round trip serveur à chaque étape)
      console.log(`[CoForm] Cache étape ${stepIndex + 1}:`, { formId, subFormId, data });
      return { success: true, subFormId, data };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: COFORM_QUERY_KEYS.formAnswers(formId),
      });
      onSuccess?.(data);
    },
    onError: (error: Error) => {
      onError?.(error);
    },
  });
}

interface UseCoFormFinalMutationOptions {
  /** ID du formulaire */
  formId: string;
  answerId?: string | null;
  onSuccess?: (data: unknown) => void;
  onError?: (error: Error) => void;
}

interface CoFormFinalMutationData {
  allData: AllStepsData;
  addedOptions?: Record<string, Record<string, string[]>>;
  /** Liens à ajouter dans answer.links (éléments Finder sélectionnés) */
  links?: Record<string, Record<string, { name: string; type: string }>>;
}

/**
 * Hook pour soumettre le formulaire complet via l'API
 * Supporte la création (nouvelle réponse) et la mise à jour (answerId fourni)
 */
export function useCoFormFinalMutation({ formId, answerId, onSuccess, onError }: UseCoFormFinalMutationOptions) {
  const { api } = useCocolight();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ allData, addedOptions, links }: CoFormFinalMutationData) => {
      if (!api) throw new Error("API non initialisée");

      // Sérialiser les réponses en JSON pour l'envoi URL-encoded
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = await (api.endpointApi as any).saveCoformAnswer({
        formId,
        answers: JSON.stringify(allData),
        ...(answerId ? { answerId } : {}),
        ...(addedOptions ? { addedOptions: JSON.stringify(addedOptions) } : {}),
        ...(links && Object.keys(links).length > 0 ? { links: JSON.stringify(links) } : {}),
      });

      return response;
    },
    onSuccess: (data) => {
      // Invalider les caches : formulaire (pour rafraîchir l'access) + réponses
      queryClient.invalidateQueries({
        queryKey: COFORM_QUERY_KEYS.form(formId),
      });
      queryClient.invalidateQueries({
        queryKey: COFORM_QUERY_KEYS.formAnswers(formId),
      });
      onSuccess?.(data);
    },
    onError: (error: Error) => {
      onError?.(error);
    },
  });
}

// ─── Hook pour charger une réponse par ID ─────────────────────────

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
 * Hook pour charger une réponse CoForm existante par son ID
 * Utilise l'endpoint COFORM_ANSWERS_BY_ID (findanswered)
 */
export function useCoFormAnswerQuery({
  formId,
  answerId,
  enabled = true,
}: UseCoFormAnswerQueryOptions): UseCoFormAnswerQueryReturn {
  const { api, loading } = useCocolight();
  const isReady = !loading && !!api;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: COFORM_QUERY_KEYS.formAnswer(formId, answerId),
    queryFn: async () => {
      if (!api) throw new Error("API non initialisée");

      const response = await api.endpointApi.coformAnswersById({
        answerId,
        fields: ["answers", "user", "created", "updated", "draft", "finished", "form", "canEdit", "editDeniedReason"],
        // Transmettre le formId pour le calcul des droits d'édition côté serveur
        ...(formId ? { formId } : {}),
      });

      const raw = response?.serverData?.data ?? response?.data;
      if (!raw) throw new Error("Réponse introuvable");

      return raw as CoFormAnswer;
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
