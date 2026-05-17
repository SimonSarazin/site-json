/**
 * Enregistrement des permissions du module cagnotte
 * Importer ce fichier (side-effect) pour rendre le namespace "cagnotte"
 * consommable via `usePermissions(['cagnotte'], entity, data)`.
 */
import { registerPermissions } from "@/lib/permissions";
import type { PermissionContext } from "@/lib/permissions";
import type { CagnottePermissionData, CagnottePermissions } from "./types";
import { calculateCagnottePermissions } from "./calculators/cagnotte";

function calculate(ctx: PermissionContext): CagnottePermissions {
  const { entity, me, data } = ctx;
  const cagnotteData = (data?.cagnotte ?? data) as CagnottePermissionData | undefined;
  return calculateCagnottePermissions(entity, me, cagnotteData);
}

registerPermissions<CagnottePermissions>({
  namespace: "cagnotte",
  calculate,
});
