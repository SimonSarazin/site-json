import { useMemo } from "react";
import { useLocation } from "react-router";
import { useHydrated } from "@/hooks/useHydrated";
import { useCocolight } from "@/hooks/useCocolight";
import { useUserPermissions, type UserPermissions } from "@/hooks/useUserPermissions";
import type { User } from "@communecter/cocolight-api-client";
import type { VisibilityCondition } from "./schema";

/**
 * Matche une route avec un pattern. Supporte `*` en fin de segment ou de pattern.
 * Exemples : "/" matche "/", "/profil/*" matche "/profil/abc/news".
 */
function matchRoute(pattern: string, pathname: string): boolean {
  if (pattern === pathname) return true;
  if (pattern.endsWith("/*")) {
    const prefix = pattern.slice(0, -2);
    return pathname === prefix || pathname.startsWith(`${prefix}/`);
  }
  if (pattern.endsWith("*")) {
    const prefix = pattern.slice(0, -1);
    return pathname.startsWith(prefix);
  }
  return false;
}

interface EvalContext {
  me: User | null;
  pathname: string;
  hydrated: boolean;
  permissions: UserPermissions;
}

/**
 * Évaluation pure d'une condition. Pas de hook ici — utilisable dans un .map().
 */
function evaluateCondition(condition: VisibilityCondition, ctx: EvalContext): boolean {
  if (!condition) return true;

  if (condition.excludeRoutes?.some((p) => matchRoute(p, ctx.pathname))) return false;
  if (condition.routes && !condition.routes.some((p) => matchRoute(p, ctx.pathname))) return false;

  const dependsOnUser =
    (condition.auth && condition.auth !== "any") ||
    (condition.permissions && condition.permissions.length > 0);

  if (dependsOnUser && !ctx.hydrated) return false;

  if (condition.auth === "required" && !ctx.me?.id) return false;
  if (condition.auth === "anonymous" && ctx.me?.id) return false;

  if (condition.permissions?.length) {
    for (const key of condition.permissions) {
      if (!ctx.permissions[key as keyof UserPermissions]) return false;
    }
  }

  return true;
}

/**
 * Évalue une `VisibilityCondition` contre l'état courant (utilisateur, route,
 * permissions). Sans condition → toujours visible.
 *
 * ⚠ SSR : avant hydration on rend une valeur "stable" pour éviter le mismatch.
 * - Si la condition dépend de `auth`/`permissions` → masqué pendant le SSR
 *   pour éviter un flash de contenu privé. Réapparaît post-hydration.
 * - Si seules `routes`/`excludeRoutes` sont utilisées → pathname est stable
 *   SSR/client, on évalue normalement.
 */
export function useVisibility(condition?: VisibilityCondition): boolean {
  const { me } = useCocolight();
  const { pathname } = useLocation();
  const hydrated = useHydrated();
  // Passer `me` comme entité : les calculateurs détectent isOwnProfile et
  // renvoient les permissions "globales" de l'utilisateur (canAddOrganization,
  // etc.). Avec `null`, tout serait à `false`.
  const permissions = useUserPermissions(me);

  return useMemo(
    () => evaluateCondition(condition, { me, pathname, hydrated, permissions }),
    [condition, me, pathname, hydrated, permissions]
  );
}

/**
 * Variante pour évaluer plusieurs conditions en une seule passe — utile pour
 * éviter d'appeler `useVisibility` dans un `.map()` (rules of hooks).
 *
 * Retourne un tableau `boolean[]` aligné avec `conditions`.
 */
export function useVisibilityList(conditions: (VisibilityCondition | undefined)[]): boolean[] {
  const { me } = useCocolight();
  const { pathname } = useLocation();
  const hydrated = useHydrated();
  const permissions = useUserPermissions(me);

  return useMemo(
    () => conditions.map((c) => evaluateCondition(c, { me, pathname, hydrated, permissions })),
    [conditions, me, pathname, hydrated, permissions]
  );
}
