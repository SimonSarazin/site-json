/**
 * Enregistrement des permissions du module AAC.
 * Importer ce fichier (side-effect) pour rendre le namespace "aac" consommable
 * via `usePermissions(['aac'], entity, data)`.
 */
import { registerPermissions } from "@/lib/permissions";
import type { PermissionContext } from "@/lib/permissions";
import type { AacPermissionData, AacPermissions } from "./types";
import { calculateAacPermissions } from "./calculators/aac";

function calculate(ctx: PermissionContext): AacPermissions {
  const { entity, me, data, isCostumAdmin } = ctx;
  const aacData = (data?.aac ?? data) as AacPermissionData | undefined;
  return calculateAacPermissions(entity, me, aacData, Boolean(isCostumAdmin));
}

registerPermissions<AacPermissions>({ namespace: "aac", calculate });
