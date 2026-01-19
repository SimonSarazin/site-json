/**
 * Enregistrement des permissions du module profil
 * Ce fichier doit être importé pour que les permissions soient disponibles
 */
import { registerPermissions } from "@/lib/permissions";
import type { PermissionContext } from "@/lib/permissions";
import { isUser, isOrganization, isProject, isEvent, isPoi } from "@/lib/getTypedEntity";
import type { User, Organization, Project, Event, Poi } from "@communecter/cocolight-api-client";
import type { ProfilPermissions } from "./types";
import { DEFAULT_PROFIL_PERMISSIONS } from "./defaults";
import {
  calculateOwnProfilePermissions,
  calculateOtherUserPermissions,
} from "./calculators/user";
import { calculateOrganizationPermissions } from "./calculators/organization";
import { calculateProjectPermissions } from "./calculators/project";
import { calculateEventPermissions } from "./calculators/event";
import { calculatePoiPermissions } from "./calculators/poi";

/**
 * Calcule les permissions profil selon le type d'entité
 */
function calculateProfilPermissions(ctx: PermissionContext): ProfilPermissions {
  const { entity, me } = ctx;

  // Si pas d'entité ou pas connectée
  if (!entity?.isConnected) {
    return DEFAULT_PROFIL_PERMISSIONS;
  }

  // Si pas connecté
  if (!me?.isConnected) {
    return {
      ...DEFAULT_PROFIL_PERMISSIONS,
      editProfileReason: "User not connected",
    };
  }

  // Pour son propre profil, pas besoin de userContext
  const isOwnProfile = isUser(entity) && me.slug === entity.slug;
  if (!isOwnProfile && !entity?.userContext) {
    return DEFAULT_PROFIL_PERMISSIONS;
  }

  // CAS 1: Son propre profil
  if (isOwnProfile) {
    return calculateOwnProfilePermissions();
  }

  // CAS 2: Profil d'un autre utilisateur
  if (isUser(entity)) {
    return calculateOtherUserPermissions(entity as User);
  }

  // CAS 3: Organisation
  if (isOrganization(entity)) {
    return calculateOrganizationPermissions(entity as Organization);
  }

  // CAS 4: Projet
  if (isProject(entity)) {
    return calculateProjectPermissions(entity as Project);
  }

  // CAS 5: Événement
  if (isEvent(entity)) {
    return calculateEventPermissions(entity as Event);
  }

  // CAS 6: POI
  if (isPoi(entity)) {
    return calculatePoiPermissions(entity as Poi);
  }

  // Type non supporté
  return {
    ...DEFAULT_PROFIL_PERMISSIONS,
    editProfileReason: "Entity type not supported for editing",
  };
}

// Enregistrement dans le registry
registerPermissions<ProfilPermissions>({
  namespace: "profil",
  calculate: calculateProfilPermissions,
});
