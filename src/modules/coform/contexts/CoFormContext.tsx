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
  /**
   * Nombre de reprises de brouillon depuis le montage. Le formulaire
   * react-hook-form de l'étape courante (`useCoFormStep`) ne se réinitialise
   * que sur changement d'index d'étape ; or reprendre un brouillon écrit sur
   * l'étape où l'on se trouve ne change pas l'index. Ce compteur donne à
   * l'effet de reset un second déclencheur, sans lui faire suivre chaque
   * `stepsData` (ce qui remettrait le formulaire « propre » à chaque
   * `submitStep` et couperait la détection de modifications).
   */
  draftRestoreCount: number;

  // Actions
  goToNextStep: () => void;
  goToPreviousStep: () => void;
  goToStep: (stepIndex: number) => void;
  saveStepData: (subFormId: string, data: SubFormData) => void;
  /**
   * Marque (ou lève) l'état « à corriger » d'une étape.
   *
   * Une validation Zod ratée n'est pas qu'une affaire d'écran courant : en
   * quittant l'étape, l'en-tête et le sommaire doivent continuer à la montrer
   * en erreur. `submitStepData` lève le drapeau de lui-même quand l'étape
   * repasse.
   */
  markStepInvalid: (subFormId: string, invalid: boolean) => void;
  /**
   * Marque (ou retire) une étape comme complétée.
   *
   * En navigation libre, aucun bouton « Suivant » n'est franchi : c'est en
   * quittant l'étape qu'on constate si elle passerait sa validation. Le sens
   * inverse compte autant — vider une étape déjà complétée doit la décompléter.
   */
  setStepCompleted: (subFormId: string, completed: boolean) => void;
  /**
   * Données de toutes les étapes, à jour à l'instant de l'appel.
   *
   * `stepState.stepsData` est capturé par les closures au rendu : après un
   * `saveStepData`, un callback fabriqué avant lui voit encore l'ancien objet.
   * C'est ce que `submitAllData` évite depuis toujours via son ref ; cette
   * fonction ouvre le même ref à ceux qui doivent juger la donnée fraîche.
   */
  getStepsData: () => AllStepsData;
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
  draftRestoreCount: 0,

  goToNextStep: () => {},
  goToPreviousStep: () => {},
  goToStep: () => {},
  saveStepData: () => {},
  markStepInvalid: () => {},
  setStepCompleted: () => {},
  getStepsData: () => ({}),
  saveAddedOptions: () => {},
  submitStepData: async () => {},
  submitAllData: async () => {},
  resetForm: () => {},
  restoreDraft: () => {},
  discardDraft: () => {},
  acknowledgeStaleDraft: () => {},
};

export const CoFormContext = createContext<CoFormContextType>(defaultCoFormContext);
