/**
 * Calculateur de permissions pour les Organizations
 */
import type { Organization } from "@communecter/cocolight-api-client";
import type { ProfilPermissions } from "../types";

/**
 * Calcule les permissions pour une Organisation
 */
export function calculateOrganizationPermissions(entity: Organization): ProfilPermissions {
  const isOrgAdmin = entity.isAdmin();
  const isOrgMember = entity.isMember();
  const isFollowingOrg = entity.isFollowing?.() ?? false;
  const isToBeValidated = entity.isToBeValidated?.() ?? false;
  const isInviting = entity.isInviting?.() ?? false;
  const isInvitingAdmin = entity.isInvitingAdmin?.() ?? false;
  const isAdminPending = entity.isAdminPending?.() ?? false;

  return {
    canEditProfile: isOrgAdmin,
    editProfileReason: isOrgAdmin ? undefined : "Must be admin of organization",
    canFollow: !isOrgAdmin, // Peut follow si pas admin (les membres peuvent follow)
    isFollowing: isFollowingOrg,
    canSendFriendRequest: false, // Pas de demandes d'ami pour les organisations
    isFriend: false,
    canRequestMembership:
      !isOrgAdmin &&
      !isOrgMember &&
      !isToBeValidated &&
      !isInviting &&
      !isInvitingAdmin &&
      !isAdminPending,
    canRequestOrganizationAdmin:
      !isOrgAdmin &&
      !isOrgMember &&
      !isToBeValidated &&
      !isInviting &&
      !isInvitingAdmin &&
      !isAdminPending,
    isMember: isOrgMember,
    isAdmin: isOrgAdmin,
    isContributor: false,
    isToBeValidated,
    isInviting,
    isInvitingAdmin,
    isAdminPending,
    hasSentFriendRequest: false,
    hasReceivedFriendRequest: false,
    canRequestContributor: false,
    canRequestProjectAdmin: false,
    canRequestPromotion: isOrgMember && !isOrgAdmin,
    isAuthor: false,
    isParticipant: false,
    canParticipate: false,
    // Admin peuvent créer des entités enfants
    canAddOrganization: false, // Pas de sous-organisation
    canAddProject: isOrgAdmin,
    canAddEvent: isOrgAdmin,
    canAddPoi: isOrgAdmin,
  };
}
