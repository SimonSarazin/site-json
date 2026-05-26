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
  /** ID du formulaire (utilisé comme préfixe de la clé de draft localStorage) */
  formId?: string;
  /** ID utilisateur connecté (clé de draft). Si absent, l'auto-save est désactivée. */
  userId?: string | null;
  /** updatedAt serveur de la réponse existante (édition) — pour détecter un draft obsolète */
  baseUpdatedAt?: number | null;
  /** Active la persistance du brouillon en localStorage. Défaut : true. */
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
  submitMode = "step",
  defaultValues,
  answerId,
  initialStepKey,
  formId,
  userId,
  baseUpdatedAt,
  enableDraft = true,
}: CoFormProviderProps) {
  const subFormsFields = useMemo(() => parseCoFormFields(formData), [formData]);

  // Persistance du brouillon en localStorage (désactivée si conditions pas réunies).
  const {
    restorableDraft,
    staleDraftInfo,
    saveDraft,
    discardDraft,
    purgeDraft,
    acknowledgeStale,
  } = useCoFormDraft({
    formId,
    userId,
    answerId,
    baseUpdatedAt,
    disabled: !enableDraft,
  });

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

  // Persistance du brouillon : déclenchée via un effet qui observe `stepState`
  // pour lire toujours la valeur post-update (pas de race avec setState).
  // Le hook sous-jacent debounce à 500ms, donc pas de churn de localStorage.
  const hasHydratedRef = useRef(false);
  useEffect(() => {
    // Skip le tout premier run : on ne veut pas écraser un éventuel draft
    // restaurable avant que l'utilisateur ait interagi avec le formulaire.
    if (!hasHydratedRef.current) {
      hasHydratedRef.current = true;
      return;
    }
    saveDraft({
      data: stepState.stepsData,
      currentStepIndex: stepState.currentStepIndex,
      completedSteps: stepState.completedSteps,
      addedOptions: stepState.addedOptions,
    });
  }, [stepState, saveDraft]);

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

        // Marquer l'étape comme complétée (la persistance est assurée par l'effet stepState)
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
        
        // Dénormaliser les données pour le format PHP (champs root-level à la
        // racine + pack des inputs multi-eval dans `_multiEval.{userId}`).
        // `defaultValues` (format serveur) sert à décider, sur les commonTable
        // vides, si on doit envoyer `{}` (clear) ou omettre (jamais rempli).
        const dataForServer = denormalizeAnswerData(
          stepsDataRef.current as Record<string, unknown>,
          subFormsFields,
          userId ?? null,
          (defaultValues as Record<string, unknown> | undefined) ?? null
        ) as AllStepsData;
        
        await onFinalSubmit(
          dataForServer,
          hasAddedOptions ? stepState.addedOptions : undefined,
          hasLinks ? links : undefined
        );

        // Succès : purger le brouillon local
        purgeDraft();
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Erreur lors de la soumission finale"));
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [submitMode, onFinalSubmit, stepState.addedOptions, subFormsFields, purgeDraft, userId, defaultValues]);

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

  // Applique le brouillon restaurable au state du formulaire
  const restoreDraft = useCallback(() => {
    if (!restorableDraft) return;
    const safeIndex = Math.min(
      Math.max(restorableDraft.currentStepIndex, 0),
      Math.max(totalSteps - 1, 0)
    );
    stepsDataRef.current = restorableDraft.data;
    setStepState({
      currentStepIndex: safeIndex,
      stepsData: restorableDraft.data,
      completedSteps: restorableDraft.completedSteps,
      errorSteps: [],
      submittingStep: null,
      addedOptions: restorableDraft.addedOptions,
    });
    // On purge aussi la clé pour fermer la bannière (on vient d'appliquer le contenu).
    // Le state en mémoire est la source de vérité ; un nouveau draft sera écrit à la prochaine modification.
    discardDraft();
  }, [restorableDraft, totalSteps, discardDraft]);

  // Métadonnées exposées au contexte (stables tant que le timestamp ne change pas)
  const restorableMeta = useMemo(
    () => (restorableDraft ? { timestamp: restorableDraft.timestamp } : null),
    [restorableDraft]
  );

  // Valeur du contexte
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
      restorableDraft: restorableMeta,
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
      acknowledgeStaleDraft: acknowledgeStale,
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
      restorableMeta,
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
      acknowledgeStale,
    ]
  );

  return <CoFormContext.Provider value={contextValue}>{children}</CoFormContext.Provider>;
};
