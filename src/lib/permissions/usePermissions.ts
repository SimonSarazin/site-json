/**
 * Hook générique pour calculer les permissions par namespace
 */
import { useMemo } from "react";
import type { EntityTypes } from "@communecter/cocolight-api-client";
import { useCocolight } from "@/hooks/useCocolight";
import type { PermissionContext } from "./types";
import { getCalculator } from "./registry";

/**
 * Hook pour calculer les permissions des namespaces demandés
 *
 * @param namespaces - Liste des namespaces à calculer (ex: ["profil", "news"])
 * @param entity - Entité concernée
 * @param data - Données additionnelles (ex: { news: currentNews })
 * @returns Objet avec les permissions par namespace
 *
 * @example
 * const { profil, news } = usePermissions<{
 *   profil: ProfilPermissions;
 *   news: NewsPermissions;
 * }>(["profil", "news"], entity, { news: currentNews });
 *
 * if (profil.canEditProfile) { ... }
 * if (news.canAddNews) { ... }
 */
export function usePermissions<T extends Record<string, unknown>>(
  namespaces: string[],
  entity: EntityTypes | null,
  data?: Record<string, unknown>
): T {
  const { me } = useCocolight();

  return useMemo(() => {
    const context: PermissionContext = { entity, me, data };
    const result: Record<string, unknown> = {};

    for (const ns of namespaces) {
      const calculator = getCalculator(ns);
      if (calculator) {
        result[ns] = calculator.calculate(context);
      } else {
        console.warn(`[permissions] No calculator registered for namespace "${ns}"`);
        result[ns] = {};
      }
    }

    return result as T;
  }, [entity, me, data, namespaces]);
}
