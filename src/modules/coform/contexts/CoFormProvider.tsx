import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CoFormContext, type CoFormContextType, type CoFormStepState } from "./CoFormContext";
import type { CoFormData, SubFormData, AllStepsData, AddedOptionsMap } from "../types";
import { parseCoFormFields, denormalizeAnswerData, extractFinderLinks, type FinderLinksMap } from "../utils/formParser";
import { useCoFormDraft } from "../hooks/useCoFormDraft";

interface CoFormProviderProps {
  children: ReactNode;
  /** Données du formulaire CoForm */
  formData: CoFormData;
  onStepSubmit?: (subFormId: string, data: SubFormData, stepIndex: number) => Promise<void>;
  onFinalSubmit?: (allData: AllStepsData, addedOptions?: Record<string, AddedOptionsMap>, links?: FinderLinksMap) => Promise<void>;
  submitMode?: "step" | "final" | "both";
  /** Valeurs par défaut pour pré-remplir le formulaire (mode édition / résumé) */
  defaultValues?: AllStepsData;
  /** ID de la réponse en cours d'édition (mode édition uniquement) */
  answerId?: string;
  /** Clé (subFormId) de l'étape initiale (pour démarrer le wizard sur une étape spécifique) */
  initialStepKey?: string;
  /** ID utilisateur connecté — clé de draft localStorage. */
  userId?: string | null;
  /** updatedAt serveur (édition) — pour détecter les drafts obsolètes. */
  baseUpdatedAt?: number | null;
  /** ID du formulaire — clé de draft localStorage. */
  formId?: string;
  /** Active la persistance du draft. Défaut : true. */
  enableDraft?: boolean;
}

/**
 * Provider du contexte CoForm
 * Gère l'état multi-étapes et les soumissions
 */
export function CoFormProvider({
  children,
  formData,
  onStepSubmit,
  onFinalSubmit,
  // Default "final" : le mode le plus safe quand le caller ne précise rien.
  // Le mode "step" (câblage step-by-step côté backend) est un futur — cf.
  // `useCoFormStepMutation` (placeholder). Avant de mettre "step" en default,
  // il faut s'assurer qu'un endpoint dédié est disponible. Voir README.md#step-mode.
  submitMode = "final",
  defaultValues,
  answerId,
  initialStepKey,
  userId,
  baseUpdatedAt,
  formId,
  enableDraft = true,
}: CoFormProviderProps) {
  const subFormsFields = useMemo(() => parseCoFormFields(formData), [formData]);

  // Warning dev : mode "step" sans onStepSubmit câblé → silencieusement no-op
  // (les données ne partent au serveur que via submitAllData, qui est filtré).
  useEffect(() => {
    if (import.meta.env.DEV && (submitMode === "step" || submitMode === "both") && !onStepSubmit) {
      console.warn(
        "[CoFormProvider] submitMode=" + submitMode + " requiert un onStepSubmit pour soumettre " +
        "chaque étape au backend. Sans cela, submitStepData reste local et le formulaire ne " +
        "persiste rien tant qu'on n'arrive pas à la dernière étape (qui appelle submitAllData). " +
        "Voir README.md#step-mode pour le statut de la feature."
      );
    }
  }, [submitMode, onStepSubmit]);

  // Résoudre l'index initial à partir de initialStepKey
  const initialStepIndex = useMemo(() => {
    if (!initialStepKey) return 0;
    const idx = subFormsFields.findIndex((sf) => sf.subFormId === initialStepKey);
    return idx >= 0 ? idx : 0;
  }, [initialStepKey, subFormsFields]);

  const [stepState, setStepState] = useState<CoFormStepState>({
    currentStepIndex: initialStepIndex,
    stepsData: defaultValues ?? {},
    completedSteps: [],
    errorSteps: [],
    submittingStep: null,
    addedOptions: {},
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Ref pour toujours avoir les dernières stepsData (évite le stale closure)
  const stepsDataRef = useRef<AllStepsData>(stepState.stepsData);
  stepsDataRef.current = stepState.stepsData;

  // Persistance du brouillon en localStorage (multi-step). Le draft inclut
  // currentStepIndex + completedSteps + stepsData + addedOptions pour pouvoir
  // restaurer la position exacte du wizard.
  const {
    restorableDraft,
    staleDraftInfo,
    saveDraft,
    discardDraft: discardDraftRaw,
    acknowledgeStale,
  } = useCoFormDraft({
    formId,
    userId,
    answerId,
    baseUpdatedAt,
    disabled: !enableDraft,
  });

  // Auto-save du draft à chaque changement de stepState (debounce interne).
  useEffect(() => {
    saveDraft({
      data: stepState.stepsData,
      currentStepIndex: stepState.currentStepIndex,
      completedSteps: stepState.completedSteps,
      addedOptions: stepState.addedOptions,
    });
  }, [stepState, saveDraft]);

  const restoreDraft = useCallback(() => {
    if (!restorableDraft) return;
    setStepState((prev) => ({
      ...prev,
      stepsData: restorableDraft.data,
      currentStepIndex: restorableDraft.currentStepIndex,
      completedSteps: restorableDraft.completedSteps,
      addedOptions: restorableDraft.addedOptions,
    }));
    discardDraftRaw();
  }, [restorableDraft, discardDraftRaw]);

  const discardDraft = useCallback(() => {
    discardDraftRaw();
  }, [discardDraftRaw]);

  const acknowledgeStaleDraft = useCallback(() => {
    acknowledgeStale();
  }, [acknowledgeStale]);

  // Calculs dérivés
  const totalSteps = subFormsFields.length;
  const currentSubFormId = subFormsFields[stepState.currentStepIndex]?.subFormId ?? null;
  const isFirstStep = stepState.currentStepIndex === 0;
  const isLastStep = stepState.currentStepIndex === totalSteps - 1;

  // Navigation entre étapes
  const goToNextStep = useCallback(() => {
    setStepState((prev) => ({
      ...prev,
      currentStepIndex: Math.min(prev.currentStepIndex + 1, totalSteps - 1),
    }));
  }, [totalSteps]);

  const goToPreviousStep = useCallback(() => {
    setStepState((prev) => ({
      ...prev,
      currentStepIndex: Math.max(prev.currentStepIndex - 1, 0),
    }));
  }, []);

  const goToStep = useCallback(
    (stepIndex: number) => {
      if (stepIndex >= 0 && stepIndex < totalSteps) {
        setStepState((prev) => ({
          ...prev,
          currentStepIndex: stepIndex,
        }));
      }
    },
    [totalSteps]
  );

  // Sauvegarde locale des données d'une étape
  const saveStepData = useCallback((subFormId: string, data: SubFormData) => {
    // Mettre à jour le ref immédiatement (synchrone) pour éviter stale closure
    const newStepsData = { ...stepsDataRef.current, [subFormId]: data };
    stepsDataRef.current = newStepsData;
    setStepState((prev) => ({
      ...prev,
      stepsData: newStepsData,
    }));
  }, []);

  // Sauvegarde des options ajoutées pour un champ
  const saveAddedOptions = useCallback((subFormId: string, fieldName: string, options: string[]) => {
    setStepState((prev) => ({
      ...prev,
      addedOptions: {
        ...prev.addedOptions,
        [subFormId]: {
          ...(prev.addedOptions[subFormId] ?? {}),
          [fieldName]: options,
        },
      },
    }));
  }, []);

  // Soumission d'une étape (avec envoi API si mode 'step' ou 'both')
  const submitStepData = useCallback(
    async (subFormId: string, data: SubFormData) => {
      setStepState((prev) => ({
        ...prev,
        submittingStep: subFormId,
        errorSteps: prev.errorSteps.filter((id) => id !== subFormId),
      }));

      try {
        // Sauvegarder les données localement
        saveStepData(subFormId, data);

        // Envoi API si mode approprié
        if ((submitMode === "step" || submitMode === "both") && onStepSubmit) {
          const stepIndex = subFormsFields.findIndex((sf) => sf.subFormId === subFormId);
          await onStepSubmit(subFormId, data, stepIndex);
        }

        // Marquer l'étape comme complétée
        setStepState((prev) => ({
          ...prev,
          completedSteps: prev.completedSteps.includes(subFormId)
            ? prev.completedSteps
            : [...prev.completedSteps, subFormId],
          submittingStep: null,
        }));

        // Passer à l'étape suivante automatiquement
        if (!isLastStep) {
          goToNextStep();
        }
      } catch (err) {
        setStepState((prev) => ({
          ...prev,
          errorSteps: [...prev.errorSteps, subFormId],
          submittingStep: null,
        }));
        setError(err instanceof Error ? err : new Error("Erreur lors de la soumission"));
        throw err;
      }
    },
    [submitMode, onStepSubmit, subFormsFields, saveStepData, isLastStep, goToNextStep]
  );

  // Soumission finale (toutes les données)
  // Lit depuis stepsDataRef pour toujours avoir les données les plus récentes
  const submitAllData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      if ((submitMode === "final" || submitMode === "both") && onFinalSubmit) {
        // Passer les addedOptions avec les données
        const hasAddedOptions = Object.keys(stepState.addedOptions).some(
          subFormId => Object.keys(stepState.addedOptions[subFormId] || {}).some(
            fieldName => (stepState.addedOptions[subFormId]?.[fieldName]?.length ?? 0) > 0
          )
        );
        
        // Extraire les links des champs Finder (avant dénormalisation)
        const links = extractFinderLinks(
          stepsDataRef.current as Record<string, unknown>,
          subFormsFields
        );
        const hasLinks = Object.keys(links).length > 0;
        
        // Dénormaliser les données pour le format PHP (champs root-level à la racine)
        const dataForServer = denormalizeAnswerData(
          stepsDataRef.current as Record<string, unknown>,
          subFormsFields
        ) as AllStepsData;
        
        await onFinalSubmit(
          dataForServer,
          hasAddedOptions ? stepState.addedOptions : undefined,
          hasLinks ? links : undefined
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Erreur lors de la soumission finale"));
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [submitMode, onFinalSubmit, stepState.addedOptions, subFormsFields]);

  // Réinitialisation
  const resetForm = useCallback(() => {
    setStepState({
      currentStepIndex: 0,
      stepsData: {},
      completedSteps: [],
      errorSteps: [],
      submittingStep: null,
      addedOptions: {},
    });
    setError(null);
  }, []);

  // Valeur du contexte
  const restorableDraftMeta = useMemo(
    () => (restorableDraft ? { timestamp: restorableDraft.timestamp } : null),
    [restorableDraft]
  );
  const contextValue: CoFormContextType = useMemo(
    () => ({
      formData,
      subFormsFields,
      stepState,
      totalSteps,
      currentSubFormId,
      answerId,
      isFirstStep,
      isLastStep,
      isLoading,
      error,
      restorableDraft: restorableDraftMeta,
      staleDraftInfo,
      goToNextStep,
      goToPreviousStep,
      goToStep,
      saveStepData,
      saveAddedOptions,
      submitStepData,
      submitAllData,
      resetForm,
      restoreDraft,
      discardDraft,
      acknowledgeStaleDraft,
    }),
    [
      formData,
      subFormsFields,
      stepState,
      totalSteps,
      currentSubFormId,
      answerId,
      isFirstStep,
      isLastStep,
      isLoading,
      error,
      restorableDraftMeta,
      staleDraftInfo,
      goToNextStep,
      goToPreviousStep,
      goToStep,
      saveStepData,
      saveAddedOptions,
      submitStepData,
      submitAllData,
      resetForm,
      restoreDraft,
      discardDraft,
      acknowledgeStaleDraft,
    ]
  );

  return <CoFormContext.Provider value={contextValue}>{children}</CoFormContext.Provider>;
};
