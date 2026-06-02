/**
 * Module coform/permissions — Exports
 *
 * Usage côté composant :
 *   import "@/modules/coform/permissions/register"; // side-effect
 *   const { coform } = usePermissions<{ coform: CoFormPermissions }>(
 *     ["coform"], entity, { access, answer }
 *   );
 *   if (coform.canSubmitAnswer) { ... }
 *   if (coform.canEditAnswer(answer)) { ... }
 */

// Types
export type {
  CoFormPermissions,
  CoFormPermissionData,
  CoFormAnswerLike,
} from "./types";

// Defaults
export { DEFAULT_COFORM_PERMISSIONS } from "./defaults";

// Calculator (usage avancé / tests)
export { calculateCoFormPermissions } from "./calculators/coform";

// Note : pour activer les permissions coform, importer le register côté entry :
//   import "@/modules/coform/permissions/register";
