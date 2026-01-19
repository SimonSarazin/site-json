/**
 * Calculateur de permissions pour les Events
 */
import type { Event } from "@communecter/cocolight-api-client";
import type { ProfilPermissions } from "../types";

/**
 * Calcule les permissions pour un Event
 */
export function calculateEventPermissions(entity: Event): ProfilPermissions {
  const isAdmin = entity.isAdmin?.({ checkHierarchy: true }) ?? false;
  const isEventAuthor = entity.isAuthor?.() ?? false;
  const isOrgAdminOrAuthor = isAdmin || isEventAuthor;
  const isEventParticipant = entity.isAttendee?.() ?? false;
  const isFollowingEvent = entity.isFollowing?.() ?? false;
  const isInviting = entity.isInviting?.() ?? false;
  const isInvitingAdmin = entity.isInvitingAdmin?.() ?? false;
  const isAdminPending = entity.isAdminPending?.() ?? false;

  return {
    canEditProfile: isOrgAdminOrAuthor,
    editProfileReason: isOrgAdminOrAuthor ? undefined : "Must be author of event",
    canFollow: true, // Peut suivre l'événement
    isFollowing: isFollowingEvent,
    canSendFriendRequest: false, // Pas de demandes d'ami pour les événements
    isFriend: false,
    canRequestMembership: false, // N/A pour événements (utilise canParticipate)
    canRequestOrganizationAdmin: false, // N/A pour événements
    isMember: false, // N/A pour événements (utilise isParticipant)
    isAdmin: false, // N/A pour événements (utilise isAuthor)
    isContributor: false,
    isToBeValidated: false,
    isInviting,
    isInvitingAdmin,
    isAdminPending,
    hasSentFriendRequest: false,
    hasReceivedFriendRequest: false,
    canRequestContributor: false,
    canRequestProjectAdmin: false,
    canRequestPromotion: false,
    isAuthor: isEventAuthor,
    isParticipant: isEventParticipant,
    canParticipate: !isEventParticipant, // Peut participer si pas déjà participant
    // Seulement l'auteur peut créer des POI sur un événement
    canAddOrganization: false,
    canAddProject: false,
    canAddEvent: false, // Pas de sous-événement
    canAddPoi: false,
  };
}
