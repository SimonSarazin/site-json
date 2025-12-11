/**
 * Calculateur de permissions pour les profils User
 */
import type { User } from "@communecter/cocolight-api-client";
import type { ProfilPermissions } from "../types";

/**
 * Calcule les permissions pour son propre profil
 */
export function calculateOwnProfilePermissions(): ProfilPermissions {
  return {
    canEditProfile: true,
    canFollow: false, // Ne peut pas se suivre soi-même
    isFollowing: false,
    canSendFriendRequest: false, // Ne peut pas s'envoyer de demande d'ami
    isFriend: false,
    canRequestMembership: false,
    canRequestOrganizationAdmin: false,
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
    isAuthor: false,
    isParticipant: false,
    canParticipate: false,
    // Peut créer toutes les entités depuis son propre profil
    canAddOrganization: true,
    canAddProject: true,
    canAddEvent: true,
    canAddPoi: true,
  };
}

/**
 * Calcule les permissions pour le profil d'un autre utilisateur
 */
export function calculateOtherUserPermissions(entity: User): ProfilPermissions {
  // Récupérer les statuts de relation
  const isFollowingUser = entity.isFollowing?.() ?? false;
  const isFriendWithUser = entity.isFriend?.() ?? false;
  // États des demandes d'ami
  const hasSentFriendRequest = entity.isInvitingFriend?.() ?? false; // J'ai envoyé une demande
  const hasReceivedFriendRequest = entity.isToBeValidatedFriend?.() ?? false; // J'ai reçu une demande

  return {
    canEditProfile: false,
    editProfileReason: "Can only edit own profile",
    canFollow: true, // Peut suivre un autre utilisateur
    isFollowing: isFollowingUser,
    canSendFriendRequest:
      !isFriendWithUser && !hasSentFriendRequest && !hasReceivedFriendRequest,
    isFriend: isFriendWithUser,
    canRequestMembership: false,
    canRequestOrganizationAdmin: false,
    isMember: false,
    isAdmin: false,
    isContributor: false,
    isToBeValidated: hasReceivedFriendRequest,
    isInviting: hasSentFriendRequest,
    isInvitingAdmin: false,
    isAdminPending: false,
    hasSentFriendRequest,
    hasReceivedFriendRequest,
    canRequestContributor: false,
    canRequestProjectAdmin: false,
    canRequestPromotion: false,
    isAuthor: false,
    isParticipant: false,
    canParticipate: false,
    // Ne peut pas créer d'entités sur le profil d'un autre utilisateur
    canAddOrganization: false,
    canAddProject: false,
    canAddEvent: false,
    canAddPoi: false,
  };
}
