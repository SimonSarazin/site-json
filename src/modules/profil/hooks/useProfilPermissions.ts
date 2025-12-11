/**
 * Hook pour les permissions profil uniquement
 * Plus léger que useUserPermissions (ne calcule pas les permissions news)
 */
import type { EntityTypes } from "@communecter/cocolight-api-client";
import { usePermissions } from "@/lib/permissions";
import type { ProfilPermissions } from "../permissions";

// Import pour déclencher l'enregistrement du calculateur
import "../permissions/register";

/**
 * Hook local pour les permissions du module profil
 *
 * Utilise directement le namespace "profil" sans calculer les permissions news.
 * Plus performant que useUserPermissions pour les composants du module profil.
 *
 * @param entity - L'entité concernée (User, Organization, Project, Event, Poi)
 * @returns Permissions profil calculées
 *
 * @example
 * const { canEditProfile, isAdmin, isMember } = useProfilPermissions(entity);
 */
export function useProfilPermissions(entity: EntityTypes | null): ProfilPermissions {
  const { profil } = usePermissions<{ profil: ProfilPermissions }>(
    ["profil"],
    entity
  );
  return profil;
}
