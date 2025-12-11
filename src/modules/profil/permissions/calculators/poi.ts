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
  const isFollowingPoi = entity.isFollowing?.() ?? false;

  return {
    canEditProfile: isPoiAuthor,
    editProfileReason: isPoiAuthor ? undefined : "Must be author of POI",
    canFollow: !isPoiAuthor, // Peut suivre si pas l'auteur
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
