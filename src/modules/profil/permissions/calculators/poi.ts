/**
 * Calculateur de permissions pour les POI (Points of Interest)
 */
import type { Poi } from "@communecter/cocolight-api-client";
import type { ProfilPermissions } from "../types";

/**
 * Calcule les permissions pour un POI
 */
export function calculatePoiPermissions(entity: Poi): ProfilPermissions {
  const isPoiAuthor = entity.isAuthor?.() ?? false;
  // Admin via la hiérarchie parent (org/projet parent → memberOf.isAdmin) — aligne sur Org/Project/Event.
  // NB : un POI de costum SANS `parent` (ex. equipementsSportifs974) est couvert en AMONT par le dispatcher
  // `register.ts` (droit-parapluie `ctx.isCostumAdmin && source.keys ∋ costumSlug`) — pas besoin ici.
  const isPoiAdmin = entity.isAdmin?.({ checkHierarchy: true }) ?? false;
  const canEdit = isPoiAuthor || isPoiAdmin;
  const isFollowingPoi = entity.isFollowing?.() ?? false;

  return {
    canEditProfile: canEdit,
    editProfileReason: canEdit ? undefined : "Must be author or admin of POI",
    canFollow: !canEdit, // Peut suivre si pas gestionnaire
    isFollowing: isFollowingPoi,
    canSendFriendRequest: false, // Pas de demandes d'ami pour les POI
    isFriend: false,
    canRequestMembership: false, // N/A pour POI
    canRequestOrganizationAdmin: false, // N/A pour POI
    isMember: false,
    isAdmin: false,
    isContributor: false,
    isToBeValidated: false,
    isInviting: false,
    isInvitingAdmin: false,
    isAdminPending: false,
    hasSentFriendRequest: false,
    hasReceivedFriendRequest: false,
    canRequestContributor: false,
    canRequestProjectAdmin: false,
    canRequestPromotion: false,
    isAuthor: isPoiAuthor,
    isParticipant: false,
    canParticipate: false,
    // Pas de création d'entités enfants sur un POI
    canAddOrganization: false,
    canAddProject: false,
    canAddEvent: false,
    canAddPoi: false,
  };
}
