/**
 * Enregistrement des permissions du module profil
 * Ce fichier doit être importé pour que les permissions soient disponibles
 */
import { registerPermissions } from "@/lib/permissions";
import type { PermissionContext } from "@/lib/permissions";
import { isUser, isOrganization, isProject, isEvent, isPoi, isClassified } from "@/lib/getTypedEntity";
import type { EntityTypes, User, Organization, Project, Event, Poi, Classified } from "@communecter/cocolight-api-client";
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
import { calculateClassifiedPermissions } from "./calculators/classified";

/** L'entité appartient-elle au périmètre du costum `slug` (`source.keys ∋ slug`, ou `source.key === slug`) ?
 *  `source.keys` peut être un OBJET à trous (byte-parité PHP `unset` d'un array non séquentiel) → normalisé. */
function entityInCostum(entity: EntityTypes | null, slug?: string): boolean {
  if (!entity || !slug) return false;
  const src = (entity as { serverData?: { source?: { key?: unknown; keys?: unknown } } }).serverData?.source;
  if (!src || typeof src !== "object") return false;
  if (src.key === slug) return true;
  const keys = src.keys;
  if (Array.isArray(keys)) return keys.includes(slug);
  if (keys && typeof keys === "object") return Object.values(keys as Record<string, unknown>).includes(slug);
  return false;
}

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

  // Droit-parapluie costum, indépendant de `entity.userContext` (repose sur le carrier + `source`) : un
  // élément DU costum reste éditable par un admin du costum même si son userContext = le propriétaire.
  const costumCanEdit = !!ctx.isCostumAdmin && entityInCostum(entity, ctx.costumSlug);

  // Pour son propre profil, pas besoin de userContext. Sinon userContext requis — SAUF droit costum (ci-dessus).
  const isOwnProfile = isUser(entity) && me.slug === entity.slug;
  if (!isOwnProfile && !entity?.userContext && !costumCanEdit) {
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

  // CAS 3-7 : ÉLÉMENTS (org/project/event/poi/classified) — éligibles au droit-parapluie costum.
  let perms: ProfilPermissions | null = null;
  if (isOrganization(entity)) perms = calculateOrganizationPermissions(entity as Organization);
  else if (isProject(entity)) perms = calculateProjectPermissions(entity as Project);
  else if (isEvent(entity)) perms = calculateEventPermissions(entity as Event);
  else if (isPoi(entity)) perms = calculatePoiPermissions(entity as Poi);
  else if (isClassified(entity)) perms = calculateClassifiedPermissions(entity as Classified);

  if (perms) {
    // Droit-parapluie COSTUM (parité legacy `elementBanner` : `canEditItem || isCostumAdmin`) : un admin du
    // costum du site peut éditer un élément DU costum (source.keys ∋ costumSlug) même sans en être auteur/admin
    // — couvre le cas POI/classified sourcé SANS parent. Le backend reste la source de vérité (isCostumAdmin).
    if (ctx.isCostumAdmin && !perms.canEditProfile && entityInCostum(entity, ctx.costumSlug)) {
      return { ...perms, canEditProfile: true, editProfileReason: undefined };
    }
    return perms;
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
