/**
 * Module profil/permissions - Exports
 */

// Types
export type { ProfilPermissions } from "./types";

// Defaults
export { DEFAULT_PROFIL_PERMISSIONS } from "./defaults";

// Calculators (pour usage avancé / tests)
export {
  calculateOwnProfilePermissions,
  calculateOtherUserPermissions,
} from "./calculators/user";
export { calculateOrganizationPermissions } from "./calculators/organization";
export { calculateProjectPermissions } from "./calculators/project";
export { calculateEventPermissions } from "./calculators/event";
export { calculatePoiPermissions } from "./calculators/poi";

// Note: Pour utiliser les permissions profil, importer le register:
// import "@/modules/profil/permissions/register";
