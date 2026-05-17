/**
 * Module CoForm - Export centralisé
 *
 * Ce module gère les formulaires dynamiques CoForm avec support multi-étapes
 * et envoi de données à chaque étape.
 */

// Side-effect : enregistre le bundle FR/EN sur i18next au montage du module.
import "./i18n/i18n";

// Side-effect : enregistre le calculateur de permissions "coform" auprès du
// registre central (`@/lib/permissions`). Tout consommateur du module pourra
// utiliser `usePermissions(['coform'], entity, data)` ou le hook ergonomique
// `useCoFormPermissions(entity, data)`.
import "./permissions/register";

// Configuration du module
export { default as moduleConfig } from "./module.config";
export { routes } from "./routes";

// Composants principaux
export { DynamicCoForm } from "./components/DynamicCoForm";
export { MultiStepCoForm } from "./components/MultiStepCoForm";
export { SmartCoForm, SmartCoForm as default } from "./components/SmartCoForm";
export { TextField, TextAreaField, RadioField, CheckboxField } from "./components/FormFields";
export { MultiCheckboxPlusField } from "./components/MultiCheckboxPlusField";
export { CoFormModal, type CoFormModalProps } from "./components/CoFormModal";

// Contexts
export { CoFormContext, type CoFormContextType, type CoFormStepState } from "./contexts/CoFormContext";
export { CoFormProvider } from "./contexts/CoFormProvider";

// Hooks
export { useCoForm, useOptionalCoForm } from "./hooks/useCoForm";
export { useCoFormStep } from "./hooks/useCoFormStep";
export { useCoFormNavigation, useCoFormSubmit } from "./hooks/useCoFormNavigation";
export { useCoFormQuery, useCoFormStepMutation, useCoFormFinalMutation } from "./hooks/useCoFormQuery";

// Utils
export {
  parseCoFormFields,
  generateZodSchema,
  generateDefaultValues,
  normalizeAnswerData,
  denormalizeAnswerData,
  extractFinderLinks,
  mapCoFormTypeToComponentType,
} from "./utils/formParser";
export type { FinderLinksMap } from "./utils/formParser";
export {
  convertBootstrapWidth,
  generateFieldId,
  extractMongoId,
  formatTimestamp,
  isStepComplete,
  mergeStepsData,
} from "./utils/helpers";

// Constants
export {
  COFORM_TYPE_MAPPING,
  BOOTSTRAP_TO_TAILWIND_WIDTH,
  COFORM_QUERY_KEYS,
  SUBMIT_MODES,
  DISPLAY_VARIANTS,
  STEP_STATUS,
} from "./constants";

// Prefetch
export {
  prefetchCoFormQuery,
  invalidateCoFormQuery,
  invalidateCoFormAnswersQuery,
} from "./prefetch";

// Schemas (Zod)
export {
  CoFormVariantSchema,
  CoFormSubmitModeSchema,
  CoFormSectionSchema,
  CoFormConfigSchema,
  type CoFormVariant,
  type CoFormSubmitMode,
  type CoFormSection,
  type CoFormConfig,
} from "./schema";

// Types
export type {
  CoFormData,
  CoFormInputField,
  CoFormParams,
  CoFormParent,
  CoFormSubFormInputs,
  FormFieldMapping,
  SubFormFields,
  SubmitMode,
  FormFieldValue,
  SubFormData,
  SubFormDataWithMeta,
  AllStepsData,
  AddedOptionsMap,
  MultiCheckboxPlusOptionType,
  MultiCheckboxPlusSelectedOption,
  MultiCheckboxPlusValue,
} from "./types";

// i18n
export { coformTranslations } from "./i18n/i18n";
