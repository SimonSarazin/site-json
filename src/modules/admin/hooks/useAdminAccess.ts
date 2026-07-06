import { useMemo } from "react";

import { useCocolight } from "@/hooks/useCocolight";
import { useHydrated } from "@/hooks/useHydrated";

import { levelSatisfies, resolveAdminAccessLevel } from "../lib/adminEntry";
import type { AdminAccessLevel } from "../schema";

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
 * Logique pure factorisée dans `lib/adminEntry.ts` (resolveAdminAccessLevel/levelSatisfies) —
 * partagée avec la source de palette de commandes et le menu avatar. P0 : superAdmin (plateforme)
 * > siteAdmin (admin du carrier costum). `entityAdmin` est résolu PAR-LIGNE en P2. TODO(lib) :
 * `me.isCostumAdmin(slug)` (user ∈ costum.admins) en OR sur siteAdmin quand la lib l'exposera.
 */
export function useAdminAccess(): AdminAccess {
  const { me, entity } = useCocolight();
  const hydrated = useHydrated();

  return useMemo(() => {
    const level = resolveAdminAccessLevel(me, entity);
    return {
      level,
      hydrated,
      has: (required: AdminAccessLevel) => levelSatisfies(level, required),
    };
  }, [me, entity, hydrated]);
}
