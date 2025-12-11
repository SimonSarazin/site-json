/**
 * Mutations génériques pour les relations (follow, join, leave)
 * Remplace useRelationshipMutations.tsx avec une approche factory
 */
import type { User } from "@communecter/cocolight-api-client";
import { createEntityMutation } from "./core";
import { QUERY_KEYS } from "../../constants/queryKeys";

// =====================================================
// FOLLOW / UNFOLLOW (toutes entités)
// =====================================================

/**
 * Hook pour suivre une entité (User, Organization, Project, Event)
 */
export const useFollowEntity = createEntityMutation({
  action: async (entity) => {
    if (entity.follow) {
      await entity.follow();
    }
  },
  i18n: {
    successKey: "toast.relationship.followSuccess",
    errorKey: "toast.relationship.followError",
  },
  invalidate: (entity) => [QUERY_KEYS.ELEMENT_ABOUT_PREFIX(entity.slug)],
});

/**
 * Hook pour ne plus suivre une entité
 */
export const useUnfollowEntity = createEntityMutation({
  action: async (entity) => {
    if (entity.unfollow) {
      await entity.unfollow();
    }
  },
  i18n: {
    successKey: "toast.relationship.unfollowSuccess",
    errorKey: "toast.relationship.unfollowError",
  },
  invalidate: (entity) => [QUERY_KEYS.ELEMENT_ABOUT_PREFIX(entity.slug)],
});

// =====================================================
// JOIN / LEAVE (Organizations, Projects, Events)
// =====================================================

/**
 * Hook pour demander à rejoindre une entité (membership/contributor/participation)
 */
export const useRequestToJoin = createEntityMutation({
  entityTypes: ["organization", "project", "event"],
  action: async (entity) => {
    if (entity.requestToJoin) {
      await entity.requestToJoin();
    }
  },
  i18n: {
    successKey: "toast.relationship.memberRequestSent",
    errorKey: "toast.relationship.memberRequestError",
  },
  invalidate: (entity, me) => [
    QUERY_KEYS.ELEMENT_ABOUT_PREFIX(entity.slug),
    ...(me ? [QUERY_KEYS.USER_ORGANIZATIONS_PREFIX(me.slug)] : []),
  ],
});

/**
 * Hook pour demander à rejoindre en tant qu'admin
 */
export const useRequestToJoinAdmin = createEntityMutation({
  entityTypes: ["organization", "project"],
  action: async (entity) => {
    if (entity.requestToJoinAdmin) {
      await entity.requestToJoinAdmin();
    }
  },
  i18n: {
    successKey: "toast.relationship.orgAdminRequestSent",
    errorKey: "toast.relationship.orgAdminRequestError",
  },
  invalidate: (entity, me) => [
    QUERY_KEYS.ELEMENT_ABOUT_PREFIX(entity.slug),
    ...(me ? [QUERY_KEYS.USER_ORGANIZATIONS_PREFIX(me.slug)] : []),
  ],
});

/**
 * Hook pour quitter une entité
 */
export const useLeaveEntity = createEntityMutation({
  entityTypes: ["organization", "project", "event"],
  action: async (entity) => {
    if (entity.leave) {
      await entity.leave();
    }
  },
  i18n: {
    successKey: "toast.relationship.memberLeftSuccess",
    errorKey: "toast.relationship.memberLeftError",
  },
  invalidate: (entity, me) => [
    QUERY_KEYS.ELEMENT_ABOUT_PREFIX(entity.slug),
    ...(me ? [QUERY_KEYS.USER_ORGANIZATIONS_PREFIX(me.slug)] : []),
  ],
});

// =====================================================
// INVITATIONS (Accept/Reject)
// =====================================================

/**
 * Hook pour accepter une invitation à rejoindre
 */
export const useAcceptInvitation = createEntityMutation({
  entityTypes: ["organization", "project", "event"],
  action: async (entity) => {
    if (entity.acceptInvitation) {
      await entity.acceptInvitation();
    }
  },
  i18n: {
    successKey: "toast.invitation.acceptSuccess",
    errorKey: "toast.invitation.acceptError",
  },
  invalidate: (entity, me) => [
    QUERY_KEYS.ELEMENT_ABOUT_PREFIX(entity.slug),
    ...(me ? [QUERY_KEYS.USER_ORGANIZATIONS_PREFIX(me.slug)] : []),
  ],
});

/**
 * Hook pour refuser une invitation (utilise leave)
 */
export const useRejectInvitation = createEntityMutation({
  entityTypes: ["organization", "project", "event"],
  action: async (entity) => {
    if (entity.leave) {
      await entity.leave();
    }
  },
  i18n: {
    successKey: "toast.invitation.rejectSuccess",
    errorKey: "toast.invitation.rejectError",
  },
  invalidate: (entity, me) => [
    QUERY_KEYS.ELEMENT_ABOUT_PREFIX(entity.slug),
    ...(me ? [QUERY_KEYS.USER_ORGANIZATIONS_PREFIX(me.slug)] : []),
  ],
});

// =====================================================
// PROMOTION (Member → Admin)
// =====================================================

/**
 * Hook pour qu'un membre/contributeur demande à devenir admin
 */
export const useRequestPromoteToAdmin = createEntityMutation({
  entityTypes: ["organization", "project"],
  action: async (entity) => {
    if (entity.requestPromoteToAdmin) {
      await entity.requestPromoteToAdmin();
    }
  },
  i18n: {
    successKey: "toast.members.requestPromoteSuccess",
    errorKey: "toast.members.requestPromoteError",
  },
  invalidate: (entity, me: User | null) => [
    QUERY_KEYS.ELEMENT_ABOUT_PREFIX(entity.slug),
    ...(me ? [QUERY_KEYS.USER_ORGANIZATIONS_PREFIX(me.slug)] : []),
  ],
});
