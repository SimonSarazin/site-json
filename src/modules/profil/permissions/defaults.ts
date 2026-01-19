/**
 * Valeurs par défaut des permissions profil
 */
import type { ProfilPermissions } from "./types";

/**
 * Permissions par défaut (tout désactivé)
 * Utilisé quand entity ou me est null
 */
export const DEFAULT_PROFIL_PERMISSIONS: ProfilPermissions = {
  // Permissions de profil
  canEditProfile: false,
  editProfileReason: "No entity provided",

  // Permissions de relations
  canFollow: false,
  isFollowing: false,
  canSendFriendRequest: false,
  isFriend: false,

  // Permissions organisation
  canRequestMembership: false,
  canRequestOrganizationAdmin: false,
  isMember: false,

  // Permissions projets
  isContributor: false,
  canRequestContributor: false,
  canRequestProjectAdmin: false,

  // Permissions organisation / projets
  isAdmin: false,
  canRequestPromotion: false,

  // Permissions événements
  isAuthor: false,
  isParticipant: false,
  canParticipate: false,

  // États d'invitation/validation
  isToBeValidated: false,
  isInviting: false,
  isInvitingAdmin: false,
  isAdminPending: false,

  // Permissions demandes d'ami
  hasSentFriendRequest: false,
  hasReceivedFriendRequest: false,

  // Permissions d'ajout d'entités
  canAddOrganization: false,
  canAddProject: false,
  canAddEvent: false,
  canAddPoi: false,
};
