/**
 * Module cagnotte/permissions — Exports
 *
 * Usage côté composant :
 *   import "@/modules/cagnotte/permissions/register"; // side-effect
 *   const { cagnotte } = usePermissions<{ cagnotte: CagnottePermissions }>(
 *     ["cagnotte"], entity, { hasActiveMilestones, projectId }
 *   );
 *   if (cagnotte.canCreateMilestone) { ... }
 */

// Types
export type {
  CagnottePermissions,
  CagnottePermissionData,
  CagnotteMilestoneLike,
  CagnotteActionLike,
  CagnotteMilestoneStatus,
  CagnotteActionStatus,
} from "./types";

// Defaults
export { DEFAULT_CAGNOTTE_PERMISSIONS } from "./defaults";

// Calculator (usage avancé / tests)
export { calculateCagnottePermissions } from "./calculators/cagnotte";

// Note : pour activer les permissions cagnotte, importer le register côté entry :
//   import "@/modules/cagnotte/permissions/register";
