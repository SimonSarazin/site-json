/**
 * Constantes du module CoForm
 */

/**
 * Mapping des types CoForm vers les types de composants React
 */
export const COFORM_TYPE_MAPPING: Record<string, string> = {
  text: "text",
  textarea: "textarea",
  "tpls.forms.cplx.radioNew": "radio",
  "tpls.forms.cplx.checkboxNew": "checkbox",
  select: "select",
  email: "email",
  number: "number",
  date: "date",
  file: "file",
  url: "url",
};

/**
 * Largeurs CSS Bootstrap vers Tailwind
 */
export const BOOTSTRAP_TO_TAILWIND_WIDTH: Record<string, string> = {
  "col-lg-12 col-md-12 col-xs-12": "w-full",
  "col-lg-6 col-md-6 col-xs-12": "w-full md:w-1/2",
  "col-lg-4 col-md-4 col-xs-12": "w-full md:w-1/3",
  "col-lg-3 col-md-3 col-xs-12": "w-full md:w-1/4",
  "col-lg-8 col-md-8 col-xs-12": "w-full md:w-2/3",
  "col-lg-9 col-md-9 col-xs-12": "w-full md:w-3/4",
};

/**
 * Clés de query React Query
 */
export const COFORM_QUERY_KEYS = {
  form: (formId: string) => ["coform", "form", formId] as const,
  formAnswers: (formId: string) => ["coform", "answers", formId] as const,
  formAnswer: (formId: string, answerId: string) => ["coform", "answer", formId, answerId] as const,
};

/**
 * Modes de soumission
 */
export const SUBMIT_MODES = {
  STEP: "step",
  FINAL: "final",
  BOTH: "both",
} as const;

/**
 * Variantes d'affichage
 */
export const DISPLAY_VARIANTS = {
  DEFAULT: "default",
  WIZARD: "wizard",
  ACCORDION: "accordion",
  TABS: "tabs",
  STEPPER: "stepper",
} as const;

/**
 * États des étapes
 */
export const STEP_STATUS = {
  PENDING: "pending",
  CURRENT: "current",
  COMPLETED: "completed",
  ERROR: "error",
} as const;
