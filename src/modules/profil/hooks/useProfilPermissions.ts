import type { EntityTypes, User, Organization, Project } from "@communecter/cocolight-api-client";
import { useCocolight } from "@/hooks/useCocolight";
import { useMemo } from "react";

export interface ProfilPermissions {
  canEditProfile: boolean;
  canFollow: boolean;
  isFollowing: boolean;
  canSendFriendRequest: boolean;
  isFriend: boolean;
  hasSentFriendRequest: boolean;
  hasReceivedFriendRequest: boolean;
  canRequestMembership: boolean;
  canRequestOrganizationAdmin: boolean;
  isMember: boolean;
  isAdmin: boolean;
  isToBeValidated: boolean;
  isInviting: boolean;
  isInvitingAdmin: boolean;
  isAdminPending: boolean;
  canRequestPromotion: boolean;
  canRequestContributor: boolean;
  canRequestProjectAdmin: boolean;
  isContributor: boolean;
  canParticipate: boolean;
  isParticipant: boolean;
  isAuthor: boolean;
}

const defaultPermissions: ProfilPermissions = {
  canEditProfile: false,
  canFollow: false,
  isFollowing: false,
  canSendFriendRequest: false,
  isFriend: false,
  hasSentFriendRequest: false,
  hasReceivedFriendRequest: false,
  canRequestMembership: false,
  canRequestOrganizationAdmin: false,
  isMember: false,
  isAdmin: false,
  isToBeValidated: false,
  isInviting: false,
  isInvitingAdmin: false,
  isAdminPending: false,
  canRequestPromotion: false,
  canRequestContributor: false,
  canRequestProjectAdmin: false,
  isContributor: false,
  canParticipate: false,
  isParticipant: false,
  isAuthor: false,
};

function safeCall<T>(fn: (() => T) | undefined, defaultValue: T): T {
  if (!fn) return defaultValue;
  try {
    return fn();
  } catch {
    return defaultValue;
  }
}

function calculateUserPermissions(entity: User, isOwnProfile: boolean): ProfilPermissions {
  if (isOwnProfile) {
    return {
      ...defaultPermissions,
      canEditProfile: true,
    };
  }

  const isFriend = safeCall(() => entity.isFriend?.(), false);
  const isFollowing = safeCall(() => entity.isFollowing?.(), false);
  const hasSentFriendRequest = safeCall(() => (entity as any).isInvitingFriend?.(), false);
  const hasReceivedFriendRequest = safeCall(() => (entity as any).isToBeValidatedFriend?.(), false);

  return {
    ...defaultPermissions,
    canFollow: !isFollowing,
    isFollowing,
    canSendFriendRequest: !isFriend && !hasSentFriendRequest && !hasReceivedFriendRequest,
    isFriend,
    hasSentFriendRequest,
    hasReceivedFriendRequest,
  };
}

function calculateOrganizationPermissions(entity: Organization): ProfilPermissions {
  const isAdmin = safeCall(() => entity.isAdmin?.(), false);
  const isMember = safeCall(() => entity.isMember?.(), false);
  const isFollowing = safeCall(() => entity.isFollowing?.(), false);
  const isToBeValidated = safeCall(() => entity.isToBeValidated?.(), false);
  const isInviting = safeCall(() => entity.isInviting?.(), false);
  const isInvitingAdmin = safeCall(() => entity.isInvitingAdmin?.(), false);
  const isAdminPending = safeCall(() => entity.isAdminPending?.(), false);

  return {
    ...defaultPermissions,
    canEditProfile: isAdmin,
    canFollow: !isAdmin,
    isFollowing,
    canRequestMembership:
      !isAdmin &&
      !isMember &&
      !isToBeValidated &&
      !isInviting &&
      !isInvitingAdmin &&
      !isAdminPending,
    canRequestOrganizationAdmin:
      !isAdmin &&
      !isMember &&
      !isToBeValidated &&
      !isInviting &&
      !isInvitingAdmin &&
      !isAdminPending,
    isMember,
    isAdmin,
    isToBeValidated,
    isInviting,
    isInvitingAdmin,
    isAdminPending,
    canRequestPromotion: isMember && !isAdmin,
    isAuthor: safeCall(() => entity.isAuthor?.(), false),
  };
}

function calculateProjectPermissions(entity: Project): ProfilPermissions {
  const isAdmin = safeCall(() => entity.isAdmin?.(), false);
  const isContributor = safeCall(() => entity.isContributor?.(), false);
  const isFollowing = safeCall(() => entity.isFollowing?.(), false);
  const isToBeValidated = safeCall(() => entity.isToBeValidated?.(), false);
  const isInviting = safeCall(() => entity.isInviting?.(), false);
  const isInvitingAdmin = safeCall(() => entity.isInvitingAdmin?.(), false);
  const isAdminPending = safeCall(() => entity.isAdminPending?.(), false);

  return {
    ...defaultPermissions,
    canEditProfile: isAdmin,
    canFollow: !isAdmin,
    isFollowing,
    canRequestContributor:
      !isAdmin &&
      !isContributor &&
      !isToBeValidated &&
      !isInviting &&
      !isInvitingAdmin &&
      !isAdminPending,
    canRequestProjectAdmin:
      !isAdmin &&
      !isContributor &&
      !isToBeValidated &&
      !isInviting &&
      !isInvitingAdmin &&
      !isAdminPending,
    isAdmin,
    isContributor,
    isToBeValidated,
    isInviting,
    isInvitingAdmin,
    isAdminPending,
    canRequestPromotion: isContributor && !isAdmin,
    isAuthor: safeCall(() => entity.isAuthor?.(), false),
  };
}

function calculateEventPermissions(entity: EntityTypes): ProfilPermissions {
  const isAdmin = safeCall(() => (entity as any).isAdmin?.(), false);
  const isAttendee = safeCall(() => (entity as any).isAttendee?.(), false);
  const isFollowing = safeCall(() => (entity as any).isFollowing?.(), false);
  const isToBeValidated = safeCall(() => (entity as any).isToBeValidated?.(), false);
  const isInviting = safeCall(() => (entity as any).isInviting?.(), false);

  return {
    ...defaultPermissions,
    canEditProfile: isAdmin,
    canFollow: true,
    isFollowing,
    canParticipate: !isAttendee && !isToBeValidated && !isInviting,
    isParticipant: isAttendee,
    isAdmin,
    isToBeValidated,
    isInviting,
    isAuthor: safeCall(() => (entity as any).isAuthor?.(), false),
  };
}

export function useProfilPermissions(entity: EntityTypes | null): ProfilPermissions {
  const { me } = useCocolight();
  const isConnected = me?.isConnected;

  return useMemo(() => {
    if (!entity || !isConnected) {
      return defaultPermissions;
    }

    const entityType = entity.getEntityType?.();
    const isOwnProfile = me?.id === entity.id;

    switch (entityType) {
      case "citoyens":
        return calculateUserPermissions(entity as User, isOwnProfile);
      case "organizations":
        return calculateOrganizationPermissions(entity as Organization);
      case "projects":
        return calculateProjectPermissions(entity as Project);
      case "events":
        return calculateEventPermissions(entity);
      default:
        return defaultPermissions;
    }
  }, [entity, me, isConnected]);
}
