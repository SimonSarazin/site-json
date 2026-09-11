/**
 * Hook pour les permissions cagnotte
 *
 * Wrapper local autour de `usePermissions` qui :
 *  - importe le register en side-effect (rend le calculateur disponible)
 *  - expose une signature ergonomique typée
 *  - mémoïse les données additionnelles pour stabiliser la référence d'objet
 *    passée au calculateur (évite des recomputations sur chaque render).
 *
 * @example
 *   const perms = useCagnottePermissions(entity, {
 *     hasActiveMilestones,
 *     ressourceId,
 *   });
 *   if (perms.canCreateMilestone) { ... }
 *   if (perms.canEditAction(action)) { ... }
 */
import { useMemo } from "react";
import type { EntityTypes } from "@communecter/cocolight-api-client";
import { usePermissions } from "@/lib/permissions";
import type {
  CagnottePermissionData,
  CagnottePermissions,
} from "../permissions";

// Import pour déclencher l'enregistrement du calculateur
import "../permissions/register";

export function useCagnottePermissions(
  entity: EntityTypes | null,
  data?: CagnottePermissionData
): CagnottePermissions {
  const ownerIdsKey = (data?.ownerIds ?? []).join("|");
  const stableData = useMemo<Record<string, unknown>>(
    () => ({
      cagnotte: {
        hasActiveItems: data?.hasActiveItems ?? false,
        resourceId: data?.resourceId ?? "",
        ownerIds: ownerIdsKey ? ownerIdsKey.split("|") : [],
      },
    }),
    [data?.hasActiveItems, data?.resourceId, ownerIdsKey]
  );

  const { cagnotte } = usePermissions<{ cagnotte: CagnottePermissions }>(
    ["cagnotte"],
    entity,
    stableData
  );
  return cagnotte;
}
