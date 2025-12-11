import type { EntityTypes } from "@communecter/cocolight-api-client";
import { isUser, isOrganization, isProject, isEvent } from "@/lib/getTypedEntity";
import { useMutationWithToast, createValidatedMutationFn } from "./core";
import { QUERY_KEYS } from "../constants";
import { useCocolight } from "@/hooks/useCocolight";

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
    namespace: "modules/profil",
    successKey: "toast.relationship.followSuccess",
    errorKey: "toast.relationship.followError",
    invalidateQueries: entity ? [QUERY_KEYS.ELEMENT_ABOUT_PREFIX(entity.slug)] : [],
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
    namespace: "modules/profil",
    successKey: "toast.relationship.unfollowSuccess",
    errorKey: "toast.relationship.unfollowError",
    invalidateQueries: entity ? [QUERY_KEYS.ELEMENT_ABOUT_PREFIX(entity.slug)] : [],
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
    namespace: "modules/profil",
    successKey: "toast.relationship.followSuccess",
    errorKey: "toast.relationship.followError",
    invalidateQueries: entity ? [QUERY_KEYS.ELEMENT_ABOUT_PREFIX(entity.slug)] : [],
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
    namespace: "modules/profil",
    successKey: "toast.relationship.unfollowSuccess",
    errorKey: "toast.relationship.unfollowError",
    invalidateQueries: entity ? [QUERY_KEYS.ELEMENT_ABOUT_PREFIX(entity.slug)] : [],
  });
}

/**
 * Hook pour demander à devenir membre d'une organisation
 */
export function useRequestMembership(entity: EntityTypes | null) {
  const { me } = useCocolight();
  return useMutationWithToast({
    mutationFn: createValidatedMutationFn(
      entity,
      isOrganization,
      "Invalid entity: must be an organization",
      (e) => e.requestToJoin()
    ),
    namespace: "modules/profil",
    successKey: "toast.relationship.memberRequestSent",
    errorKey: "toast.relationship.memberRequestError",
    invalidateQueries: [
      ...(entity ? [QUERY_KEYS.ELEMENT_ABOUT_PREFIX(entity.slug), QUERY_KEYS.ORGANIZATION_MEMBERS_PREFIX(entity.slug)] : []),
      ...(me ? [QUERY_KEYS.USER_ORGANIZATIONS_PREFIX(me.slug)] : []),
    ],
  });
}

/**
 * Hook pour demander à devenir admin direct d'une organisation (non-membre)
 */
export function useRequestOrganizationAdmin(entity: EntityTypes | null) {
  const { me } = useCocolight();
  return useMutationWithToast({
    mutationFn: createValidatedMutationFn(
      entity,
      isOrganization,
      "Invalid entity: must be an organization",
      (e) => e.requestToJoinAdmin()
    ),
    namespace: "modules/profil",
    successKey: "toast.relationship.orgAdminRequestSent",
    errorKey: "toast.relationship.orgAdminRequestError",
    invalidateQueries: [
      ...(entity ? [QUERY_KEYS.ELEMENT_ABOUT_PREFIX(entity.slug), QUERY_KEYS.ORGANIZATION_MEMBERS_PREFIX(entity.slug)] : []),
      ...(me ? [QUERY_KEYS.USER_ORGANIZATIONS_PREFIX(me.slug)] : []),
    ],
  });
}

/**
 * Hook pour quitter une organisation
 */
export function useLeaveOrganization(entity: EntityTypes | null) {
  const { me } = useCocolight();
  return useMutationWithToast({
    mutationFn: createValidatedMutationFn(
      entity,
      isOrganization,
      "Invalid entity: must be an organization",
      (e) => e.leave()
    ),
    namespace: "modules/profil",
    successKey: "toast.relationship.memberLeftSuccess",
    errorKey: "toast.relationship.memberLeftError",
    invalidateQueries: [
      ...(entity ? [QUERY_KEYS.ELEMENT_ABOUT_PREFIX(entity.slug), QUERY_KEYS.ORGANIZATION_MEMBERS_PREFIX(entity.slug)] : []),
      ...(me ? [QUERY_KEYS.USER_ORGANIZATIONS_PREFIX(me.slug)] : []),
    ],
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
    namespace: "modules/profil",
    successKey: "toast.relationship.followSuccess",
    errorKey: "toast.relationship.followError",
    invalidateQueries: entity ? [QUERY_KEYS.ELEMENT_ABOUT_PREFIX(entity.slug)] : [],
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
    namespace: "modules/profil",
    successKey: "toast.relationship.unfollowSuccess",
    errorKey: "toast.relationship.unfollowError",
    invalidateQueries: entity ? [QUERY_KEYS.ELEMENT_ABOUT_PREFIX(entity.slug)] : [],
  });
}

/**
 * Hook pour demander à rejoindre un projet en tant que contributeur
 */
export function useRequestContributor(entity: EntityTypes | null) {
  const { me } = useCocolight();
  return useMutationWithToast({
    mutationFn: createValidatedMutationFn(
      entity,
      isProject,
      "Invalid entity: must be a project",
      (e) => e.requestToJoin()
    ),
    namespace: "modules/profil",
    successKey: "toast.relationship.contributorRequestSent",
    errorKey: "toast.relationship.contributorRequestError",
    invalidateQueries: [
      ...(entity ? [QUERY_KEYS.ELEMENT_ABOUT_PREFIX(entity.slug), QUERY_KEYS.PROJECT_CONTRIBUTORS_PREFIX(entity.slug)] : []),
      ...(me ? [QUERY_KEYS.USER_PROJECTS_PREFIX(me.slug)] : []),
    ],
  });
}

/**
 * Hook pour demander à devenir admin d'un projet
 */
export function useRequestProjectAdmin(entity: EntityTypes | null) {
  const { me } = useCocolight();
  return useMutationWithToast({
    mutationFn: createValidatedMutationFn(
      entity,
      isProject,
      "Invalid entity: must be a project",
      (e) => e.requestToJoinAdmin()
    ),
    namespace: "modules/profil",
    successKey: "toast.relationship.projectAdminRequestSent",
    errorKey: "toast.relationship.projectAdminRequestError",
    invalidateQueries: [
      ...(entity ? [QUERY_KEYS.ELEMENT_ABOUT_PREFIX(entity.slug), QUERY_KEYS.PROJECT_CONTRIBUTORS_PREFIX(entity.slug)] : []),
      ...(me ? [QUERY_KEYS.USER_PROJECTS_PREFIX(me.slug)] : []),
    ],
  });
}

/**
 * Hook pour quitter un projet
 */
export function useLeaveProject(entity: EntityTypes | null) {
  const { me } = useCocolight();
  return useMutationWithToast({
    mutationFn: createValidatedMutationFn(
      entity,
      isProject,
      "Invalid entity: must be a project",
      (e) => e.leave()
    ),
    namespace: "modules/profil",
    successKey: "toast.relationship.projectLeftSuccess",
    errorKey: "toast.relationship.projectLeftError",
    invalidateQueries: [
      ...(entity ? [QUERY_KEYS.ELEMENT_ABOUT_PREFIX(entity.slug), QUERY_KEYS.PROJECT_CONTRIBUTORS_PREFIX(entity.slug)] : []),
      ...(me ? [QUERY_KEYS.USER_PROJECTS_PREFIX(me.slug)] : []),
    ],
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
    namespace: "modules/profil",
    successKey: "toast.relationship.followSuccess",
    errorKey: "toast.relationship.followError",
    invalidateQueries: entity ? [QUERY_KEYS.ELEMENT_ABOUT_PREFIX(entity.slug)] : [],
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
    namespace: "modules/profil",
    successKey: "toast.relationship.unfollowSuccess",
    errorKey: "toast.relationship.unfollowError",
    invalidateQueries: entity ? [QUERY_KEYS.ELEMENT_ABOUT_PREFIX(entity.slug)] : [],
  });
}

/**
 * Hook pour participer à un événement
 */
export function useParticipateEvent(entity: EntityTypes | null) {
  const { me } = useCocolight();
  return useMutationWithToast({
    mutationFn: createValidatedMutationFn(
      entity,
      isEvent,
      "Invalid entity: must be an event",
      (e) => e.requestToJoin()
    ),
    namespace: "modules/profil",
    successKey: "toast.relationship.participationSuccess",
    errorKey: "toast.relationship.participationError",
    invalidateQueries: [
      ...(entity ? [QUERY_KEYS.ELEMENT_ABOUT_PREFIX(entity.slug), QUERY_KEYS.EVENT_ATTENDEES_PREFIX(entity.slug)] : []),
      ...(me ? [QUERY_KEYS.USER_EVENTS_PREFIX(me.slug)] : []),
    ],
  });
}

/**
 * Hook pour ne plus participer à un événement
 */
export function useLeaveEvent(entity: EntityTypes | null) {
  const { me } = useCocolight();
  return useMutationWithToast({
    mutationFn: createValidatedMutationFn(
      entity,
      isEvent,
      "Invalid entity: must be an event",
      (e) => e.leave()
    ),
    namespace: "modules/profil",
    successKey: "toast.relationship.participationLeftSuccess",
    errorKey: "toast.relationship.participationLeftError",
    invalidateQueries: [
      ...(entity ? [QUERY_KEYS.ELEMENT_ABOUT_PREFIX(entity.slug), QUERY_KEYS.EVENT_ATTENDEES_PREFIX(entity.slug)] : []),
      ...(me ? [QUERY_KEYS.USER_EVENTS_PREFIX(me.slug)] : []),
    ],
  });
}

// =====================================================
// INVITATION MUTATIONS (Accept/Reject)
// =====================================================

/**
 * Hook pour accepter une invitation à rejoindre une organisation
 */
export function useAcceptOrgInvitation(entity: EntityTypes | null) {
  const { me } = useCocolight();
  return useMutationWithToast({
    mutationFn: createValidatedMutationFn(
      entity,
      isOrganization,
      "Invalid entity: must be an organization",
      (e) => e.acceptInvitation()
    ),
    namespace: "modules/profil",
    successKey: "toast.invitation.acceptSuccess",
    errorKey: "toast.invitation.acceptError",
    invalidateQueries: [
      ...(entity ? [QUERY_KEYS.ELEMENT_ABOUT_PREFIX(entity.slug), QUERY_KEYS.ORGANIZATION_MEMBERS_PREFIX(entity.slug)] : []),
      ...(me ? [QUERY_KEYS.USER_ORGANIZATIONS_PREFIX(me.slug)] : []),
    ],
  });
}

/**
 * Hook pour refuser une invitation à rejoindre une organisation
 */
export function useRejectOrgInvitation(entity: EntityTypes | null) {
  const { me } = useCocolight();
  return useMutationWithToast({
    mutationFn: createValidatedMutationFn(
      entity,
      isOrganization,
      "Invalid entity: must be an organization",
      (e) => e.leave()
    ),
    namespace: "modules/profil",
    successKey: "toast.invitation.rejectSuccess",
    errorKey: "toast.invitation.rejectError",
    invalidateQueries: [
      ...(entity ? [QUERY_KEYS.ELEMENT_ABOUT_PREFIX(entity.slug)] : []),
      ...(me ? [QUERY_KEYS.USER_ORGANIZATIONS_PREFIX(me.slug)] : []),
    ],
  });
}

/**
 * Hook pour accepter une invitation à rejoindre un projet
 */
export function useAcceptProjectInvitation(entity: EntityTypes | null) {
  const { me } = useCocolight();
  return useMutationWithToast({
    mutationFn: createValidatedMutationFn(
      entity,
      isProject,
      "Invalid entity: must be a project",
      (e) => e.acceptInvitation()
    ),
    namespace: "modules/profil",
    successKey: "toast.invitation.acceptSuccess",
    errorKey: "toast.invitation.acceptError",
    invalidateQueries: [
      ...(entity ? [QUERY_KEYS.ELEMENT_ABOUT_PREFIX(entity.slug), QUERY_KEYS.PROJECT_CONTRIBUTORS_PREFIX(entity.slug)] : []),
      ...(me ? [QUERY_KEYS.USER_PROJECTS_PREFIX(me.slug)] : []),
    ],
  });
}

/**
 * Hook pour refuser une invitation à rejoindre un projet
 */
export function useRejectProjectInvitation(entity: EntityTypes | null) {
  const { me } = useCocolight();
  return useMutationWithToast({
    mutationFn: createValidatedMutationFn(
      entity,
      isProject,
      "Invalid entity: must be a project",
      (e) => e.leave()
    ),
    namespace: "modules/profil",
    successKey: "toast.invitation.rejectSuccess",
    errorKey: "toast.invitation.rejectError",
    invalidateQueries: [
      ...(entity ? [QUERY_KEYS.ELEMENT_ABOUT_PREFIX(entity.slug)] : []),
      ...(me ? [QUERY_KEYS.USER_PROJECTS_PREFIX(me.slug)] : []),
    ],
  });
}

/**
 * Hook pour accepter une invitation à participer à un événement
 */
export function useAcceptEventInvitation(entity: EntityTypes | null) {
  const { me } = useCocolight();
  return useMutationWithToast({
    mutationFn: createValidatedMutationFn(
      entity,
      isEvent,
      "Invalid entity: must be an event",
      (e) => e.acceptInvitation()
    ),
    namespace: "modules/profil",
    successKey: "toast.invitation.acceptSuccess",
    errorKey: "toast.invitation.acceptError",
    invalidateQueries: [
      ...(entity ? [QUERY_KEYS.ELEMENT_ABOUT_PREFIX(entity.slug), QUERY_KEYS.EVENT_ATTENDEES_PREFIX(entity.slug)] : []),
      ...(me ? [QUERY_KEYS.USER_EVENTS_PREFIX(me.slug)] : []),
    ],
  });
}

/**
 * Hook pour refuser une invitation à participer à un événement
 */
export function useRejectEventInvitation(entity: EntityTypes | null) {
  const { me } = useCocolight();
  return useMutationWithToast({
    mutationFn: createValidatedMutationFn(
      entity,
      isEvent,
      "Invalid entity: must be an event",
      (e) => e.leave()
    ),
    namespace: "modules/profil",
    successKey: "toast.invitation.rejectSuccess",
    errorKey: "toast.invitation.rejectError",
    invalidateQueries: [
      ...(entity ? [QUERY_KEYS.ELEMENT_ABOUT_PREFIX(entity.slug)] : []),
      ...(me ? [QUERY_KEYS.USER_EVENTS_PREFIX(me.slug)] : []),
    ],
  });
}
