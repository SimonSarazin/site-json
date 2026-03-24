import { createContext } from "react";
import type { CoFormData, SubFormFields, SubFormData, AllStepsData, AddedOptionsMap } from "../types";

/**
 * État du formulaire multi-étapes
 */
export interface CoFormStepState {
  currentStepIndex: number;
  /** Données saisies pour chaque étape (par subFormId) */
  stepsData: AllStepsData;
  completedSteps: string[];
  errorSteps: string[];
  submittingStep: string | null;
  /** Options ajoutées dynamiquement par les champs multiCheckboxPlus (par subFormId puis par fieldName) */
  addedOptions: Record<string, AddedOptionsMap>;
}

/**
 * Contexte du formulaire CoForm
 */
export interface CoFormContextType {
  /** Données brutes du formulaire CoForm */
  formData: CoFormData | null;
  /** Champs parsés par sous-formulaire */
  subFormsFields: SubFormFields[];
  /** État des étapes */
  stepState: CoFormStepState;
  /** Nombre total d'étapes */
  totalSteps: number;
  currentSubFormId: string | null;
  /** ID de la réponse en cours d'édition (mode édition uniquement) */
  answerId?: string;
  isFirstStep: boolean;
  isLastStep: boolean;
  isLoading: boolean;
  error: Error | null;

  // Actions
  goToNextStep: () => void;
  goToPreviousStep: () => void;
  goToStep: (stepIndex: number) => void;
  saveStepData: (subFormId: string, data: SubFormData) => void;
  saveAddedOptions: (subFormId: string, fieldName: string, options: string[]) => void;
  submitStepData: (subFormId: string, data: SubFormData) => Promise<void>;
  submitAllData: () => Promise<void>;
  resetForm: () => void;
}

/**
 * Valeurs par défaut du contexte
 */
export const defaultCoFormContext: CoFormContextType = {
  formData: null,
  subFormsFields: [],
  stepState: {
    currentStepIndex: 0,
    stepsData: {},
    completedSteps: [],
    errorSteps: [],
    submittingStep: null,
    addedOptions: {},
  },
  totalSteps: 0,
  currentSubFormId: null,
  answerId: undefined,
  isFirstStep: true,
  isLastStep: true,
  isLoading: false,
  error: null,

  goToNextStep: () => {},
  goToPreviousStep: () => {},
  goToStep: () => {},
  saveStepData: () => {},
  saveAddedOptions: () => {},
  submitStepData: async () => {},
  submitAllData: async () => {},
  resetForm: () => {},
};

export const CoFormContext = createContext<CoFormContextType>(defaultCoFormContext);
