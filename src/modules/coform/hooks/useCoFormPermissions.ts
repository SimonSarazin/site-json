/**
 * Hook pour les permissions coform.
 *
 * Wrapper local autour de `usePermissions` qui :
 *  - importe le register en side-effect (rend le calculateur disponible) ;
 *  - expose une signature ergonomique typée ;
 *  - mémoïse les données additionnelles pour stabiliser la référence d'objet
 *    passée au calculateur (évite des recomputations sur chaque render).
 *
 * @example
 *   const perms = useCoFormPermissions(entity, {
 *     access: formAccess,
 *     answer: currentAnswer,
 *   });
 *   if (perms.canSubmitAnswer) { ... }
 *   if (perms.canEditAnswer(answer)) { ... }
 */
import { useMemo } from "react";
import type { EntityTypes } from "@communecter/cocolight-api-client";
import { usePermissions } from "@/lib/permissions";
import type {
  CoFormPermissionData,
  CoFormPermissions,
} from "../permissions";

// Import pour déclencher l'enregistrement du calculateur côté `permissions` registry.
import "../permissions/register";

export function useCoFormPermissions(
  entity: EntityTypes | null,
  data?: CoFormPermissionData,
): CoFormPermissions {
  const stableData = useMemo<Record<string, unknown>>(
    () => ({
      coform: {
        access: data?.access ?? null,
        answer: data?.answer ?? null,
      },
    }),
    [data?.access, data?.answer],
  );

  const { coform } = usePermissions<{ coform: CoFormPermissions }>(
    ["coform"],
    entity,
    stableData,
  );
  return coform;
}
