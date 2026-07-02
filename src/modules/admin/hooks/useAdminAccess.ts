import { useMemo } from "react";

import { useCocolight } from "@/hooks/useCocolight";
import { useHydrated } from "@/hooks/useHydrated";

import type { AdminAccessLevel } from "../schema";

const RANK: Record<AdminAccessLevel, number> = {
  entityAdmin: 1,
  siteAdmin: 2,
  superAdmin: 3,
};

export interface AdminAccess {
  /** Niveau le plus fort atteint par l'utilisateur (null = aucun accès admin). */
  level: AdminAccessLevel | null;
  /** Hydraté côté client (client island : ne rien afficher tant que false). */
  hydrated: boolean;
  /** L'utilisateur satisfait-il le niveau requis ? */
  has: (required: AdminAccessLevel) => boolean;
}

/**
 * Niveau d'accès admin de l'utilisateur courant (aligné sur les 5 niveaux legacy, cf. plan §5).
 * P0 : superAdmin (plateforme) > siteAdmin (admin du carrier costum). `entityAdmin` est résolu
 * PAR-LIGNE en P2 (un utilisateur admin d'UNE org). `me.isCostumAdmin(slug)` (user ∈ costum.admins)
 * sera ajouté en OR sur siteAdmin au merge de la MR lib.
 */
export function useAdminAccess(): AdminAccess {
  const { me, entity } = useCocolight();
  const hydrated = useHydrated();

  return useMemo(() => {
    // La lib PUBLIÉE n'a pas encore `me.isSuperAdmin()` (méthode non publiée) → on lit `roles` en direct
    // (pattern site-json). TODO(publish lib): remplacer par `me.isSuperAdmin()` / `me.isCostumAdmin(slug)`.
    const roles = (me?.serverData as { roles?: Record<string, unknown> } | undefined)?.roles ?? {};
    const isSuper = roles.superAdmin === true || roles.adminPlatform === true;

    let level: AdminAccessLevel | null = null;
    if (isSuper) {
      level = "superAdmin";
    } else if (entity?.isAdmin?.()) {
      // siteAdmin = admin de l'entité porteuse du costum (carrier). TODO(merge lib): || me.isCostumAdmin(slug)
      level = "siteAdmin";
    }
    return {
      level,
      hydrated,
      has: (required: AdminAccessLevel) => level != null && RANK[level] >= RANK[required],
    };
  }, [me, entity, hydrated]);
}
