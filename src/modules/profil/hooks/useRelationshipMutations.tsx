import type { EntityTypes } from "@communecter/cocolight-api-client";
import { isUser, isOrganization, isProject, isEvent } from "@/lib/getTypedEntity";
import { useMutationWithToast, createValidatedMutationFn } from "./core";
import { QUERY_KEYS } from "../constants";

// =====================================================
// USER RELATIONSHIP MUTATIONS
// =====================================================

/**
 * Hook pour suivre un utilisateur
 */
export function useFollowUser(entity: EntityTypes | null) {
  return useMutationWithToast({
    mutationFn: createValidatedMutationFn(
      entity,
      isUser,
      "Invalid entity: must be a user",
      (e) => e.follow()
    ),
    successKey: "toast.relationship.followSuccess",
    errorKey: "toast.relationship.followError",
    invalidateQueries: entity ? [QUERY_KEYS.ELEMENT_ABOUT(entity.slug)] : [],
  });
}

/**
 * Hook pour ne plus suivre un utilisateur
 */
export function useUnfollowUser(entity: EntityTypes | null) {
  return useMutationWithToast({
    mutationFn: createValidatedMutationFn(
      entity,
      isUser,
      "Invalid entity: must be a user",
      (e) => e.unfollow()
    ),
    successKey: "toast.relationship.unfollowSuccess",
    errorKey: "toast.relationship.unfollowError",
    invalidateQueries: entity ? [QUERY_KEYS.ELEMENT_ABOUT(entity.slug)] : [],
  });
}

/**
 * Hook pour envoyer une demande d'ami
 */
export function useSendFriendRequest(entity: EntityTypes | null) {
  return useMutationWithToast({
    mutationFn: createValidatedMutationFn(
      entity,
      isUser,
      "Invalid entity: must be a user",
      (e) => e.sendFriendRequest()
    ),
    successKey: "toast.relationship.friendRequestSent",
    errorKey: "toast.relationship.friendRequestError",
    invalidateQueries: entity
      ? [
          QUERY_KEYS.ELEMENT_ABOUT(entity.slug),
          QUERY_KEYS.USER_FRIENDS(entity.slug),
          QUERY_KEYS.USER_SENT_FRIEND_REQUESTS(entity.slug),
        ]
      : [],
  });
}

/**
 * Hook pour retirer un ami
 */
export function useRemoveFriend(entity: EntityTypes | null) {
  return useMutationWithToast({
    mutationFn: createValidatedMutationFn(
      entity,
      isUser,
      "Invalid entity: must be a user",
      (e) => e.removeFriend()
    ),
    successKey: "toast.relationship.friendRemoved",
    errorKey: "toast.relationship.friendRemoveError",
    invalidateQueries: entity
      ? [QUERY_KEYS.ELEMENT_ABOUT(entity.slug), QUERY_KEYS.USER_FRIENDS(entity.slug)]
      : [],
  });
}

// =====================================================
// ORGANIZATION RELATIONSHIP MUTATIONS
// =====================================================

/**
 * Hook pour suivre une organisation
 */
export function useFollowOrganization(entity: EntityTypes | null) {
  return useMutationWithToast({
    mutationFn: createValidatedMutationFn(
      entity,
      isOrganization,
      "Invalid entity: must be an organization",
      (e) => e.follow()
    ),
    successKey: "toast.relationship.followSuccess",
    errorKey: "toast.relationship.followError",
    invalidateQueries: entity ? [QUERY_KEYS.ELEMENT_ABOUT(entity.slug)] : [],
  });
}

/**
 * Hook pour ne plus suivre une organisation
 */
export function useUnfollowOrganization(entity: EntityTypes | null) {
  return useMutationWithToast({
    mutationFn: createValidatedMutationFn(
      entity,
      isOrganization,
      "Invalid entity: must be an organization",
      (e) => e.unfollow()
    ),
    successKey: "toast.relationship.unfollowSuccess",
    errorKey: "toast.relationship.unfollowError",
    invalidateQueries: entity ? [QUERY_KEYS.ELEMENT_ABOUT(entity.slug)] : [],
  });
}

/**
 * Hook pour demander à devenir membre d'une organisation
 */
export function useRequestMembership(entity: EntityTypes | null) {
  return useMutationWithToast({
    mutationFn: createValidatedMutationFn(
      entity,
      isOrganization,
      "Invalid entity: must be an organization",
      (e) => e.requestToJoin()
    ),
    successKey: "toast.relationship.memberRequestSent",
    errorKey: "toast.relationship.memberRequestError",
    invalidateQueries: entity ? [QUERY_KEYS.ELEMENT_ABOUT(entity.slug)] : [],
  });
}

/**
 * Hook pour quitter une organisation
 */
export function useLeaveOrganization(entity: EntityTypes | null) {
  return useMutationWithToast({
    mutationFn: createValidatedMutationFn(
      entity,
      isOrganization,
      "Invalid entity: must be an organization",
      (e) => e.leave()
    ),
    successKey: "toast.relationship.memberLeftSuccess",
    errorKey: "toast.relationship.memberLeftError",
    invalidateQueries: entity ? [QUERY_KEYS.ELEMENT_ABOUT(entity.slug)] : [],
  });
}

// =====================================================
// PROJECT RELATIONSHIP MUTATIONS
// =====================================================

/**
 * Hook pour suivre un projet
 */
export function useFollowProject(entity: EntityTypes | null) {
  return useMutationWithToast({
    mutationFn: createValidatedMutationFn(
      entity,
      isProject,
      "Invalid entity: must be a project",
      (e) => e.follow()
    ),
    successKey: "toast.relationship.followSuccess",
    errorKey: "toast.relationship.followError",
    invalidateQueries: entity ? [QUERY_KEYS.ELEMENT_ABOUT(entity.slug)] : [],
  });
}

/**
 * Hook pour ne plus suivre un projet
 */
export function useUnfollowProject(entity: EntityTypes | null) {
  return useMutationWithToast({
    mutationFn: createValidatedMutationFn(
      entity,
      isProject,
      "Invalid entity: must be a project",
      (e) => e.unfollow()
    ),
    successKey: "toast.relationship.unfollowSuccess",
    errorKey: "toast.relationship.unfollowError",
    invalidateQueries: entity ? [QUERY_KEYS.ELEMENT_ABOUT(entity.slug)] : [],
  });
}

/**
 * Hook pour demander à rejoindre un projet en tant que contributeur
 */
export function useRequestContributor(entity: EntityTypes | null) {
  return useMutationWithToast({
    mutationFn: createValidatedMutationFn(
      entity,
      isProject,
      "Invalid entity: must be a project",
      (e) => e.requestToJoin()
    ),
    successKey: "toast.relationship.contributorRequestSent",
    errorKey: "toast.relationship.contributorRequestError",
    invalidateQueries: entity ? [QUERY_KEYS.ELEMENT_ABOUT(entity.slug)] : [],
  });
}

/**
 * Hook pour demander à devenir admin d'un projet
 */
export function useRequestProjectAdmin(entity: EntityTypes | null) {
  return useMutationWithToast({
    mutationFn: createValidatedMutationFn(
      entity,
      isProject,
      "Invalid entity: must be a project",
      (e) => e.requestToJoinAdmin()
    ),
    successKey: "toast.relationship.projectAdminRequestSent",
    errorKey: "toast.relationship.projectAdminRequestError",
    invalidateQueries: entity ? [QUERY_KEYS.ELEMENT_ABOUT(entity.slug)] : [],
  });
}

/**
 * Hook pour quitter un projet
 */
export function useLeaveProject(entity: EntityTypes | null) {
  return useMutationWithToast({
    mutationFn: createValidatedMutationFn(
      entity,
      isProject,
      "Invalid entity: must be a project",
      (e) => e.leave()
    ),
    successKey: "toast.relationship.projectLeftSuccess",
    errorKey: "toast.relationship.projectLeftError",
    invalidateQueries: entity ? [QUERY_KEYS.ELEMENT_ABOUT(entity.slug)] : [],
  });
}

// =====================================================
// EVENT RELATIONSHIP MUTATIONS
// =====================================================

/**
 * Hook pour suivre un événement
 */
export function useFollowEvent(entity: EntityTypes | null) {
  return useMutationWithToast({
    mutationFn: createValidatedMutationFn(
      entity,
      isEvent,
      "Invalid entity: must be an event",
      (e) => e.follow()
    ),
    successKey: "toast.relationship.followSuccess",
    errorKey: "toast.relationship.followError",
    invalidateQueries: entity ? [QUERY_KEYS.ELEMENT_ABOUT(entity.slug)] : [],
  });
}

/**
 * Hook pour ne plus suivre un événement
 */
export function useUnfollowEvent(entity: EntityTypes | null) {
  return useMutationWithToast({
    mutationFn: createValidatedMutationFn(
      entity,
      isEvent,
      "Invalid entity: must be an event",
      (e) => e.unfollow()
    ),
    successKey: "toast.relationship.unfollowSuccess",
    errorKey: "toast.relationship.unfollowError",
    invalidateQueries: entity ? [QUERY_KEYS.ELEMENT_ABOUT(entity.slug)] : [],
  });
}

/**
 * Hook pour participer à un événement
 */
export function useParticipateEvent(entity: EntityTypes | null) {
  return useMutationWithToast({
    mutationFn: createValidatedMutationFn(
      entity,
      isEvent,
      "Invalid entity: must be an event",
      (e) => e.requestToJoin()
    ),
    successKey: "toast.relationship.participationSuccess",
    errorKey: "toast.relationship.participationError",
    invalidateQueries: entity ? [QUERY_KEYS.ELEMENT_ABOUT(entity.slug)] : [],
  });
}

/**
 * Hook pour ne plus participer à un événement
 */
export function useLeaveEvent(entity: EntityTypes | null) {
  return useMutationWithToast({
    mutationFn: createValidatedMutationFn(
      entity,
      isEvent,
      "Invalid entity: must be an event",
      (e) => e.leave()
    ),
    successKey: "toast.relationship.participationLeftSuccess",
    errorKey: "toast.relationship.participationLeftError",
    invalidateQueries: entity ? [QUERY_KEYS.ELEMENT_ABOUT(entity.slug)] : [],
  });
}
