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
 *     projectId,
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
  const stableData = useMemo<Record<string, unknown>>(
    () => ({
      cagnotte: {
        hasActiveMilestones: data?.hasActiveMilestones ?? false,
        projectId: data?.projectId ?? "",
      },
    }),
    [data?.hasActiveMilestones, data?.projectId]
  );

  const { cagnotte } = usePermissions<{ cagnotte: CagnottePermissions }>(
    ["cagnotte"],
    entity,
    stableData
  );
  return cagnotte;
}
