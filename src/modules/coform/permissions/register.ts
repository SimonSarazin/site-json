/**
 * Enregistrement des permissions du module coform.
 * Importer ce fichier (side-effect) pour rendre le namespace "coform"
 * consommable via `usePermissions(['coform'], entity, data)`.
 */
import { registerPermissions } from "@/lib/permissions";
import type { PermissionContext } from "@/lib/permissions";
import type { CoFormPermissionData, CoFormPermissions } from "./types";
import { calculateCoFormPermissions } from "./calculators/coform";

function calculate(ctx: PermissionContext): CoFormPermissions {
  const { entity, me, data } = ctx;
  const coformData = (data?.coform ?? data) as CoFormPermissionData | undefined;
  return calculateCoFormPermissions(entity, me, coformData);
}

registerPermissions<CoFormPermissions>({
  namespace: "coform",
  calculate,
});
