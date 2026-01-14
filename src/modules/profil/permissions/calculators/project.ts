/**
 * Calculateur de permissions pour les Projects
 */
import type { Project } from "@communecter/cocolight-api-client";
import type { ProfilPermissions } from "../types";

/**
 * Calcule les permissions pour un Project
 */
export function calculateProjectPermissions(entity: Project): ProfilPermissions {
  const isProjectAdmin = entity.isAdmin?.() ?? false;
  const isProjectContributor = entity.isContributor?.() ?? false;
  const isFollowingProject = entity.isFollowing?.() ?? false;
  const isToBeValidated = entity.isToBeValidated?.() ?? false;
  const isInviting = entity.isInviting?.() ?? false;
  const isInvitingAdmin = entity.isInvitingAdmin?.() ?? false;
  const isAdminPending = entity.isAdminPending?.() ?? false;

  return {
    canEditProfile: isProjectAdmin,
    editProfileReason: isProjectAdmin ? undefined : "Must be admin of project",
    canFollow: !isProjectAdmin && !isProjectContributor, // Peut suivre si pas déjà membre/admin
    isFollowing: isFollowingProject,
    canSendFriendRequest: false, // Pas de demandes d'ami pour les projets
    isFriend: false,
    canRequestMembership: false, // N/A pour projets (utilise canRequestContributor)
    canRequestOrganizationAdmin: false, // N/A pour projets
    isMember: false, // N/A pour projets (utilise isContributor)
    isAdmin: isProjectAdmin,
    isContributor: isProjectContributor,
    isToBeValidated,
    isInviting,
    isInvitingAdmin,
    isAdminPending,
    hasSentFriendRequest: false,
    hasReceivedFriendRequest: false,
    canRequestContributor:
      !isProjectAdmin &&
      !isProjectContributor &&
      !isToBeValidated &&
      !isInviting &&
      !isInvitingAdmin &&
      !isAdminPending,
    canRequestProjectAdmin:
      !isProjectAdmin &&
      !isProjectContributor &&
      !isToBeValidated &&
      !isInviting &&
      !isInvitingAdmin &&
      !isAdminPending,
    canRequestPromotion: isProjectContributor && !isProjectAdmin && !isAdminPending,
    isAuthor: false,
    isParticipant: false,
    canParticipate: false,
    // Admin ou contributeur peuvent créer des entités enfants
    canAddOrganization: false,
    canAddProject: false, // Pas de sous-projet
    canAddEvent: isProjectAdmin,
    canAddPoi: isProjectAdmin,
  };
}
