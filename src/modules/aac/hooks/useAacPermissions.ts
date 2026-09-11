/**
 * Hook ergonomique des permissions AAC (wrapper autour de `usePermissions`).
 * Importe le register en side-effect et mémoïse les données additionnelles.
 *
 * @example
 *   const perms = useAacPermissions(entity, { gates, isCommunityMember });
 *   if (perms.canCreateCommun) { ... }
 */
import { useMemo } from "react";
import type { EntityTypes } from "@communecter/cocolight-api-client";
import { usePermissions } from "@/lib/permissions";
import type { AacPermissionData, AacPermissions } from "../permissions";

// Import pour déclencher l'enregistrement du calculateur.
import "../permissions/register";

export function useAacPermissions(
  entity: EntityTypes | null,
  data?: AacPermissionData
): AacPermissions {
  const stableData = useMemo<Record<string, unknown>>(
    () => ({ aac: data ?? {} }),
    [data]
  );

  const { aac } = usePermissions<{ aac: AacPermissions }>(
    ["aac"],
    entity,
    stableData
  );
  return aac;
}
