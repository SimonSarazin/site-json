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
  const { me, entity: carrier } = useCocolight();
  // Droit-parapluie costum, résolu UNE fois : le carrier est le HOST du costum du site ; `carrier.isAdmin`
  // (sync, via me.links) = admin du host = isCostumAdmin (même signal que `siteAdmin` d'adminEntry). Un
  // costum-admin peut ainsi éditer les éléments DU costum (source.keys ∋ costumSlug) hors /admin — parité legacy.
  // `carrier.isAdmin()` SANS checkHierarchy = admin DIRECT du host — même définition que le siteAdmin canonique
  // (adminEntry.resolveAdminAccessLevel) et que le backend isCostumAdmin (isElementAdmin du host, sans récursion).
  const costumHost = carrier as { isAdmin?: () => boolean; slug?: string } | null;
  const isCostumAdmin = costumHost?.isAdmin?.() ?? false;
  const costumSlug = costumHost?.slug ?? undefined;

  // Si l'utilisateur est admin du costum ET que l'entité affichée appartient à ce costum (source.keys ∋ slug),
  // on pose le flag lib `setCostumAdminAuthorized` sur l'instance : les gardes client d'édition/suppression
  // (_update/_deleteViaElement) laisseront passer un non-auteur, comme le legacy `canEditItem || isCostumAdmin`
  // sur les fiches publiques. Idempotent ; le backend reste la source de vérité (canEditItem porte isCostumAdmin).
  if (isCostumAdmin && costumSlug && entity) {
    const src = (entity as { serverData?: { source?: { key?: unknown; keys?: unknown } } }).serverData?.source;
    // `source.keys` peut être array OU objet à trous (byte-parité PHP `unset`) → normaliser.
    const keys = src?.keys;
    const keyList = Array.isArray(keys) ? keys : (keys && typeof keys === "object" ? Object.values(keys as Record<string, unknown>) : []);
    const inCostum = !!src && typeof src === "object" && (src.key === costumSlug || keyList.includes(costumSlug));
    if (inCostum) (entity as { setCostumAdminAuthorized?: (v?: boolean) => void }).setCostumAdminAuthorized?.();
  }

  return useMemo(() => {
    const context: PermissionContext = { entity, me, isCostumAdmin, costumSlug, data };
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
  }, [entity, me, isCostumAdmin, costumSlug, data, namespaces]);
}
