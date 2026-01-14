/**
 * Types de permissions pour le module profil
 */

/**
 * Permissions calculées pour le module profil
 * Inclut les permissions d'édition, relations, membership, etc.
 */
export interface ProfilPermissions {
  // Permissions de profil
  canEditProfile: boolean;
  editProfileReason?: string;

  // Permissions de relations (follow/friend pour utilisateurs)
  canFollow: boolean;
  isFollowing: boolean;
  canSendFriendRequest: boolean;
  isFriend: boolean;

  // Permissions organisation
  canRequestMembership: boolean;
  canRequestOrganizationAdmin: boolean;
  isMember: boolean;

  // Permissions projets
  isContributor: boolean;
  canRequestContributor: boolean;
  canRequestProjectAdmin: boolean;

  // Permissions organisation / projets
  isAdmin: boolean;
  canRequestPromotion: boolean;

  // Permissions événements
  isAuthor: boolean;
  isParticipant: boolean;
  canParticipate: boolean;

  // États d'invitation/validation
  isToBeValidated: boolean;
  isInviting: boolean;
  isInvitingAdmin: boolean;
  isAdminPending: boolean;

  // Permissions demandes d'ami (Users uniquement)
  hasSentFriendRequest: boolean;
  hasReceivedFriendRequest: boolean;

  // Permissions d'ajout d'entités
  canAddOrganization: boolean;
  canAddProject: boolean;
  canAddEvent: boolean;
  canAddPoi: boolean;
}
