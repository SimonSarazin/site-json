/**
 * Module AAC (Appel à Communs) — export centralisé.
 *
 * Un « commun » = une réponse Coform (document `answers`). Le module se pose SUR
 * l'acquis coform / cagnotte / observatoire / search (cf. plan SOCLE). Ce jalon
 * ne livre que les FONDATIONS (scaffold + résolveur AacConfig + types + section
 * stub) — aucune surface fonctionnelle.
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

// Schémas : bloc de config site (`config.aac`, singulier) + section
export { AacConfigSchema, AacSectionSchema } from "./schema";
export type { AacConfig, AacSection, AacSectionProps } from "./schema";

// Hooks publics
export { useAacConfig } from "./hooks/useAacConfig";
export { useAacPermissions } from "./hooks/useAacPermissions";

// Résolveur pur (tests / usage avancé)
export { resolveAacConfig } from "./lib/resolveAacConfig";

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
