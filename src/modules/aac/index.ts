/**
 * Module AAC (Appel à Communs) — export centralisé.
 *
 * Un « commun » = une réponse Coform (document `answers`). Le module se pose SUR
 * l'acquis coform / cagnotte / observatoire / search (cf. plan SOCLE).
 */

// Side-effects : enregistre le bundle i18n "modules/aac" + le calculateur de
// permissions "aac" auprès des registres centraux.
import "./i18n";
import "./permissions/register";

// Configuration du module
export { default as moduleConfig } from "./module.config";

// Constants (queryKeys)
export { AAC_QUERY_KEYS } from "./constants/queryKeys";
export type { AacQueryKeyType } from "./constants/queryKeys";

// Schémas : bloc de config site (`config.aac`, singulier) + sections
export {
  AacConfigSchema,
  AacDirectorySectionSchema,
  AacHighlightSectionSchema,
  AacDirectoryFieldsSchema,
} from "./schema";
export type {
  AacConfig,
  AacDirectorySection,
  AacDirectorySectionProps,
  AacHighlightSection,
  AacHighlightSectionProps,
  AacDirectoryFieldsConfig,
} from "./schema";

// Hooks publics
export { useAacConfig } from "./hooks/useAacConfig";
export { useAacPermissions } from "./hooks/useAacPermissions";
export { useAacFormMeta, useAacContextId } from "./hooks/useAacFormMeta";
export { useAacCommuns } from "./hooks/useAacCommuns";

// Fonctions pures (tests / usage avancé)
export { resolveAacConfig } from "./lib/resolveAacConfig";
export { buildAacFormMeta, readOptionList } from "./lib/formMeta";
export { resolveAacCardFields } from "./lib/resolveAacCardFields";
export { parseAacAnswer } from "./lib/parseAacAnswer";
export { filterCommuns, foldForSearch } from "./lib/filterCommuns";
export { aacFiltersKey, hasActiveFilters, EMPTY_AAC_FILTERS } from "./lib/filtersKey";

export type { AacFormMeta, AacQuestionMeta, AacOption } from "./lib/formMeta";
export type {
  AacCardFields,
  AacCardFieldRef,
  AacCardFieldRole,
  AacCardFieldSource,
} from "./lib/resolveAacCardFields";
export type { AacCommunCard, AacFund } from "./lib/parseAacAnswer";
export type { AacDirectoryFiltersState } from "./lib/filtersKey";
export type { AacCommunsQuery, AacCommunsPage } from "./lib/communsTransport";

// Permissions (le register est déjà chargé en side-effect ci-dessus)
export {
  calculateAacPermissions,
  DEFAULT_AAC_PERMISSIONS,
} from "./permissions";
export type {
  AacPermissions,
  AacPermissionData,
  AacGateFlags,
  AacCommunLike,
} from "./permissions";

// Types du contrat
export type {
  AacResolvedConfig,
  AacCriteriaSource,
  AacStep,
  AacStepRoles,
  AacGates,
  AacCriterion,
  Commun,
  Depense,
  Financer,
  Campagne,
  Panier,
  PanierLigne,
  AacLog,
  CommunState,
  FinancerEntityType,
  FundingType,
  CampagneType,
  PaymentProvider,
} from "./types";
