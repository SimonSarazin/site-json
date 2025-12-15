/**
 * Système de permissions extensible par module
 *
 * @example
 * // Dans un module, enregistrer ses permissions:
 * registerPermissions<MyPermissions>({
 *   namespace: "myModule",
 *   calculate: (ctx) => calculateMyPermissions(ctx),
 * });
 *
 * // Dans un composant, utiliser les permissions:
 * const { myModule } = usePermissions<{ myModule: MyPermissions }>(
 *   ["myModule"],
 *   entity
 * );
 */

// Types
export type { PermissionContext, PermissionCalculator, PermissionsResult } from "./types";

// Registry
export { registerPermissions, getCalculator, getAllCalculators, hasCalculator } from "./registry";

// Hook
export { usePermissions } from "./usePermissions";
