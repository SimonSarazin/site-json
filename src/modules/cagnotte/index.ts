/**
 * Module Cagnotte — Export centralisé
 *
 * Module pour le financement collaboratif de projets via milestones (jalons).
 * Croise deux collections : `projects.oceco.milestones[]` (définition des jalons)
 * et `answers.aapStep1.depense[]` (miroir financier avec `financer[]`).
 *
 * Note : les sections JSON (`actions`, `finance`, `actions-summary`, `finance-summary`)
 * ne sont pas exposées ici — elles sont chargées en lazy par `SectionRenderer.tsx` via
 * un import dynamique direct (`@/modules/cagnotte/components/sections/...`) pour
 * préserver le code-splitting de `vite-preload`.
 */

// Side-effect : enregistre le namespace i18n "modules/cagnotte" auprès d'i18next.
// Tout consommateur du module charge automatiquement les traductions FR/EN.
import "./i18n";

// Side-effect : enregistre le calculateur de permissions "cagnotte" auprès du
// registre central (`@/lib/permissions`). Tout consommateur du module pourra
// utiliser `usePermissions(['cagnotte'], entity, data)`.
import "./permissions/register";

// Configuration du module
export { default as moduleConfig } from "./module.config";

// Constants (queryKeys partagés)
export { CAGNOTTE_QUERY_KEYS } from "./constants/queryKeys";
export type { CagnotteQueryKeyType } from "./constants/queryKeys";

// Composants principaux (consommés hors du module)
export { default as CagnotteDialog } from "./components/CagnotteDialog";
export { default as PaymentConfigPage } from "./components/PaymentConfigPage";
export { default as StripePaymentForm } from "./components/StripePaymentForm";

// Hooks publics
export { useFundingEnvelope } from "./hooks/useFundingEnvelope";
export { useProjectModalCagnotte } from "./hooks/useProjectModalCagnotte";
export { useUserAdminOrganizations } from "./hooks/useUserAdminOrganizations";
export { useSaveCagnotteContribution } from "./hooks/useSaveCagnotteContribution";
export { useCagnottePermissions } from "./hooks/useCagnottePermissions";
export { useCagnotteContext, useCagnotteContextSafe } from "./hooks/useCagnotteContext";

// Contexts publics — pour wrapper manuel ou usage avancé
export { CagnotteProvider, CagnotteContext } from "./contexts";
export type {
  CagnotteContextValue,
  MilestoneEventDetail,
  MilestoneEventListener,
  Unsubscribe,
} from "./contexts";

// Types DTO du hook useFundingEnvelope (utiles pour consommateurs externes)
export type {
  FundingEnvelopeNormalizedData,
  FundingMilestone,
  FundingAction,
  FundingProject,
  FundingContributor,
  FundingTransaction,
  FundingPaymentMethods,
  FundingActionStatus,
  FundingPaymentStatus,
} from "./hooks/useFundingEnvelope";

// Lib — orchestration milestones (sync projects ↔ answers)
export {
  editMilestoneWithSync,
  closeMilestoneWithSync,
  restoreMilestoneWithSync,
  deleteMilestoneWithSync,
  getApiErrorMessage,
} from "./lib/milestoneMutationHandlers";
export {
  updateActionField,
  updateProjectActionFields,
  appendProjectMilestone,
  appendAnswerDepense,
  deleteActionById,
  updateProjectMilestoneFields,
  updateAnswerDepenseFields,
  deleteProjectMilestoneAtIndex,
  deleteAnswerDepenseAtIndex,
} from "./lib/actionMilestonePathUpdates";
export {
  asRecord,
  getEntityIdFromUnknown,
  getEnvelopeProjects,
  resolveMilestoneSyncContext,
} from "./lib/milestoneSyncContext";
export type { MilestoneSyncContext } from "./lib/milestoneSyncContext";

// Types DTO
export type { AdminOrganization } from "./hooks/useUserAdminOrganizations";

// Mutation hooks (factory) — pour piloter les milestones et actions depuis les composants
export {
  createMilestoneMutation,
  useEditMilestone,
  useCloseMilestone,
  useRestoreMilestone,
  useDeleteMilestone,
  useCreateMilestone,
  createActionMutation,
  useCandidateAction,
  useMarkActionDone,
  useDeleteAction,
  useEditAction,
} from "./actions/mutations";
export type {
  MilestoneMutationContext,
  EditMilestoneParams,
  SimpleMilestoneParams,
  CreateMilestoneParams,
  ActionMutationContext,
  CandidateActionParams,
  MarkActionDoneParams,
  DeleteActionParams,
  EditActionParams,
} from "./actions/mutations";

// Permissions — calculateurs + types (le register est déjà chargé via side-effect plus haut)
export {
  calculateCagnottePermissions,
  DEFAULT_CAGNOTTE_PERMISSIONS,
} from "./permissions";
export type {
  CagnottePermissions,
  CagnottePermissionData,
  CagnotteMilestoneLike,
  CagnotteActionLike,
  CagnotteMilestoneStatus,
  CagnotteActionStatus,
} from "./permissions";

// Prefetch SSR
export {
  prefetchFundingEnvelope,
  hasCagnotteSection,
  CAGNOTTE_SECTION_TYPES,
} from "./prefetch";
export type { PrefetchFundingEnvelopeParams } from "./prefetch";
