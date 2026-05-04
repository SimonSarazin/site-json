import { useCallback, useState } from "react";
import { useCoForm } from "./useCoForm";
import type { AllStepsData } from "../types";

interface UseCoFormNavigationReturn {
  currentStepIndex: number;
  totalSteps: number;
  isFirstStep: boolean;
  isLastStep: boolean;
  progressPercent: number;
  completedSteps: string[];
  canGoNext: boolean;
  canGoPrevious: boolean;
  next: () => void;
  previous: () => void;
  goTo: (index: number) => void;
}

/**
 * Hook pour la navigation entre les étapes du formulaire
 */
export function useCoFormNavigation(): UseCoFormNavigationReturn {
  const coform = useCoForm();

  // Progression basée sur l'état réel : étapes soumises avec succès + 0.5 pour l'étape
  // courante si pas encore complétée. Évite d'afficher 100 % à l'arrivée sur la dernière
  // étape alors qu'elle n'a pas encore été remplie ni soumise.
  const completed = coform.stepState.completedSteps.length;
  const currentIsCompleted = coform.currentSubFormId
    ? coform.stepState.completedSteps.includes(coform.currentSubFormId)
    : false;
  const inProgress = currentIsCompleted ? 0 : 0.5;
  const progressPercent =
    coform.totalSteps > 0
      ? Math.min(100, Math.round(((completed + inProgress) / coform.totalSteps) * 100))
      : 0;

  const canGoNext = !coform.isLastStep;
  const canGoPrevious = !coform.isFirstStep;

  return {
    currentStepIndex: coform.stepState.currentStepIndex,
    totalSteps: coform.totalSteps,
    isFirstStep: coform.isFirstStep,
    isLastStep: coform.isLastStep,
    progressPercent,
    completedSteps: coform.stepState.completedSteps,
    canGoNext,
    canGoPrevious,
    next: coform.goToNextStep,
    previous: coform.goToPreviousStep,
    goTo: coform.goToStep,
  };
}

interface UseCoFormSubmitOptions {
  onSuccess?: (data: AllStepsData) => void;
  onError?: (error: Error) => void;
}

interface UseCoFormSubmitReturn {
  allData: AllStepsData;
  isSubmitting: boolean;
  isComplete: boolean;
  error: Error | null;
  submit: () => Promise<void>;
  reset: () => void;
}

/**
 * Hook pour la soumission finale du formulaire
 */
export function useCoFormSubmit(options: UseCoFormSubmitOptions = {}): UseCoFormSubmitReturn {
  const { onSuccess, onError } = options;
  const coform = useCoForm();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isComplete =
    coform.totalSteps > 0 &&
    coform.stepState.completedSteps.length === coform.totalSteps;

  const submit = useCallback(async () => {
    setIsSubmitting(true);
    try {
      await coform.submitAllData();
      onSuccess?.(coform.stepState.stepsData);
    } catch (err) {
      onError?.(err instanceof Error ? err : new Error("Erreur de soumission"));
    } finally {
      setIsSubmitting(false);
    }
  }, [coform, onSuccess, onError]);

  return {
    allData: coform.stepState.stepsData,
    isSubmitting,
    isComplete,
    error: coform.error,
    submit,
    reset: coform.resetForm,
  };
}
