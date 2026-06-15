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

  /** Métadonnées du brouillon restaurable. null si aucun draft valide. */
  restorableDraft: { timestamp: number } | null;
  /** Métadonnées du brouillon écarté (server plus récent). null si absent. */
  staleDraftInfo: { timestamp: number } | null;

  // Actions
  goToNextStep: () => void;
  goToPreviousStep: () => void;
  goToStep: (stepIndex: number) => void;
  saveStepData: (subFormId: string, data: SubFormData) => void;
  saveAddedOptions: (subFormId: string, fieldName: string, options: string[]) => void;
  submitStepData: (subFormId: string, data: SubFormData) => Promise<void>;
  submitAllData: () => Promise<void>;
  resetForm: () => void;
  /** Applique le brouillon restaurable au state. No-op si aucun draft. */
  restoreDraft: () => void;
  /** Refuse le brouillon restaurable (le supprime du localStorage). */
  discardDraft: () => void;
  /** Ferme la bannière d'information sur un brouillon obsolète. */
  acknowledgeStaleDraft: () => void;
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

  restorableDraft: null,
  staleDraftInfo: null,

  goToNextStep: () => {},
  goToPreviousStep: () => {},
  goToStep: () => {},
  saveStepData: () => {},
  saveAddedOptions: () => {},
  submitStepData: async () => {},
  submitAllData: async () => {},
  resetForm: () => {},
  restoreDraft: () => {},
  discardDraft: () => {},
  acknowledgeStaleDraft: () => {},
};

export const CoFormContext = createContext<CoFormContextType>(defaultCoFormContext);
