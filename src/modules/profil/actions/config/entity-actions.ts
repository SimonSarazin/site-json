/**
 * Configuration déclarative des actions sur les entités
 * Définit tous les types d'actions (follow, friend, join, etc.)
 */
import type { ActionIconKey } from "./icons";
import type { EntityAction } from "../../types";

type ActionType = EntityAction["type"];
type ActionVariant = EntityAction["variant"];

interface ConfirmationConfig {
  titleKey: string;
  descriptionKey: string;
  confirmKey: string;
  cancelKey: string;
}

export interface EntityActionConfig {
  id: string;
  type: ActionType;
  icon: ActionIconKey;
  variant: ActionVariant;
  requiresConfirmation: boolean;
  i18nKey: string;
  confirmation?: ConfirmationConfig;
  isDestructive?: boolean;
}

/**
 * Configuration de toutes les actions disponibles sur les entités
 * Utilisé par buildEntityAction pour générer les objets EntityAction
 */
export const ENTITY_ACTION_CONFIG = {
  // ============ FOLLOW/UNFOLLOW ============
  follow: {
    id: "follow",
    type: "follow",
    icon: "userPlus",
    variant: "outline",
    requiresConfirmation: false,
    i18nKey: "ProfileTemplateDefault.follow",
  },
  unfollow: {
    id: "unfollow",
    type: "unfollow",
    icon: "userCheck",
    variant: "outline",
    requiresConfirmation: true,
    i18nKey: "ProfileTemplateDefault.unfollow",
    confirmation: {
      titleKey: "ProfileTemplateDefault.unfollowDialog.title",
      descriptionKey: "ProfileTemplateDefault.unfollowDialog.description",
      confirmKey: "ProfileTemplateDefault.unfollowDialog.confirm",
      cancelKey: "ProfileTemplateDefault.unfollowDialog.cancel",
    },
  },

  // ============ FRIEND ACTIONS (Users only) ============
  sendFriendRequest: {
    id: "friend",
    type: "friend",
    icon: "userPlus",
    variant: "outline",
    requiresConfirmation: false,
    i18nKey: "ProfileTemplateDefault.sendFriendRequest",
  },
  removeFriend: {
    id: "unfriend",
    type: "unfriend",
    icon: "userX",
    variant: "outline",
    requiresConfirmation: false,
    i18nKey: "ProfileTemplateDefault.removeFriend",
  },
  acceptFriendRequest: {
    id: "acceptFriend",
    type: "accept",
    icon: "check",
    variant: "default",
    requiresConfirmation: false,
    i18nKey: "ProfileTemplateDefault.acceptFriendRequest",
  },
  rejectFriendRequest: {
    id: "rejectFriend",
    type: "reject",
    icon: "x",
    variant: "outline",
    requiresConfirmation: true,
    i18nKey: "ProfileTemplateDefault.rejectFriendRequest",
    confirmation: {
      titleKey: "ProfileTemplateDefault.rejectFriendDialog.title",
      descriptionKey: "ProfileTemplateDefault.rejectFriendDialog.description",
      confirmKey: "ProfileTemplateDefault.rejectFriendDialog.confirm",
      cancelKey: "ProfileTemplateDefault.rejectFriendDialog.cancel",
    },
  },
  friendRequestPending: {
    id: "friendPending",
    type: "pending",
    icon: "clock",
    variant: "outline",
    requiresConfirmation: false,
    i18nKey: "ProfileTemplateDefault.friendRequestPending",
  },
  cancelFriendRequest: {
    id: "cancelFriend",
    type: "leave",
    icon: "x",
    variant: "outline",
    requiresConfirmation: true,
    i18nKey: "ProfileTemplateDefault.cancelFriendRequest",
    confirmation: {
      titleKey: "ProfileTemplateDefault.cancelFriendDialog.title",
      descriptionKey: "ProfileTemplateDefault.cancelFriendDialog.description",
      confirmKey: "ProfileTemplateDefault.cancelFriendDialog.confirm",
      cancelKey: "ProfileTemplateDefault.cancelFriendDialog.cancel",
    },
  },

  // ============ MEMBERSHIP (Organizations) ============
  requestMembership: {
    id: "join",
    type: "join",
    icon: "users",
    variant: "default",
    requiresConfirmation: true,
    i18nKey: "ProfileTemplateDefault.requestMembership",
    confirmation: {
      titleKey: "ProfileTemplateDefault.membershipDialog.title",
      descriptionKey: "ProfileTemplateDefault.membershipDialog.description",
      confirmKey: "ProfileTemplateDefault.membershipDialog.confirm",
      cancelKey: "ProfileTemplateDefault.membershipDialog.cancel",
    },
  },
  requestOrganizationAdmin: {
    id: "requestAdmin",
    type: "join",
    icon: "userCheck",
    variant: "default",
    requiresConfirmation: true,
    i18nKey: "ProfileTemplateDefault.requestOrganizationAdmin",
    confirmation: {
      titleKey: "ProfileTemplateDefault.orgAdminDialog.title",
      descriptionKey: "ProfileTemplateDefault.orgAdminDialog.description",
      confirmKey: "ProfileTemplateDefault.orgAdminDialog.confirm",
      cancelKey: "ProfileTemplateDefault.orgAdminDialog.cancel",
    },
  },
  membershipPending: {
    id: "pending",
    type: "pending",
    icon: "clock",
    variant: "outline",
    requiresConfirmation: false,
    i18nKey: "ProfileTemplateDefault.membershipPending",
  },
  leaveOrganization: {
    id: "leave",
    type: "leave",
    icon: "logout",
    variant: "destructive",
    requiresConfirmation: true,
    i18nKey: "ProfileTemplateDefault.leaveOrganization",
    confirmation: {
      titleKey: "ProfileTemplateDefault.leaveDialog.title",
      descriptionKey: "ProfileTemplateDefault.leaveDialog.description",
      confirmKey: "ProfileTemplateDefault.leaveDialog.confirm",
      cancelKey: "ProfileTemplateDefault.leaveDialog.cancel",
    },
    isDestructive: true,
  },

  // ============ CONTRIBUTOR (Projects) ============
  requestContributor: {
    id: "join",
    type: "join",
    icon: "users",
    variant: "default",
    requiresConfirmation: true,
    i18nKey: "ProfileTemplateDefault.requestContributor",
    confirmation: {
      titleKey: "ProfileTemplateDefault.contributorDialog.title",
      descriptionKey: "ProfileTemplateDefault.contributorDialog.description",
      confirmKey: "ProfileTemplateDefault.contributorDialog.confirm",
      cancelKey: "ProfileTemplateDefault.contributorDialog.cancel",
    },
  },
  requestProjectAdmin: {
    id: "requestAdmin",
    type: "join",
    icon: "userCheck",
    variant: "default",
    requiresConfirmation: true,
    i18nKey: "ProfileTemplateDefault.requestProjectAdmin",
    confirmation: {
      titleKey: "ProfileTemplateDefault.projectAdminDialog.title",
      descriptionKey: "ProfileTemplateDefault.projectAdminDialog.description",
      confirmKey: "ProfileTemplateDefault.projectAdminDialog.confirm",
      cancelKey: "ProfileTemplateDefault.projectAdminDialog.cancel",
    },
  },
  contributorPending: {
    id: "pending",
    type: "pending",
    icon: "clock",
    variant: "outline",
    requiresConfirmation: false,
    i18nKey: "ProfileTemplateDefault.contributorPending",
  },
  leaveProject: {
    id: "leave",
    type: "leave",
    icon: "logout",
    variant: "destructive",
    requiresConfirmation: true,
    i18nKey: "ProfileTemplateDefault.leaveProject",
    confirmation: {
      titleKey: "ProfileTemplateDefault.leaveProjectDialog.title",
      descriptionKey: "ProfileTemplateDefault.leaveProjectDialog.description",
      confirmKey: "ProfileTemplateDefault.leaveProjectDialog.confirm",
      cancelKey: "ProfileTemplateDefault.leaveProjectDialog.cancel",
    },
    isDestructive: true,
  },

  // ============ PARTICIPATION (Events) ============
  participate: {
    id: "participate",
    type: "join",
    icon: "users",
    variant: "default",
    requiresConfirmation: true,
    i18nKey: "ProfileTemplateDefault.participate",
    confirmation: {
      titleKey: "ProfileTemplateDefault.participateDialog.title",
      descriptionKey: "ProfileTemplateDefault.participateDialog.description",
      confirmKey: "ProfileTemplateDefault.participateDialog.confirm",
      cancelKey: "ProfileTemplateDefault.participateDialog.cancel",
    },
  },
  participationPending: {
    id: "pending",
    type: "pending",
    icon: "clock",
    variant: "outline",
    requiresConfirmation: false,
    i18nKey: "ProfileTemplateDefault.participationPending",
  },
  leaveEvent: {
    id: "leave",
    type: "leave",
    icon: "logout",
    variant: "destructive",
    requiresConfirmation: true,
    i18nKey: "ProfileTemplateDefault.leaveEvent",
    confirmation: {
      titleKey: "ProfileTemplateDefault.leaveEventDialog.title",
      descriptionKey: "ProfileTemplateDefault.leaveEventDialog.description",
      confirmKey: "ProfileTemplateDefault.leaveEventDialog.confirm",
      cancelKey: "ProfileTemplateDefault.leaveEventDialog.cancel",
    },
    isDestructive: true,
  },

  // ============ PROMOTION (Member → Admin) ============
  requestPromotion: {
    id: "requestPromotion",
    type: "join",
    icon: "userCheck",
    variant: "default",
    requiresConfirmation: true,
    i18nKey: "ProfileTemplateDefault.requestPromotion",
    confirmation: {
      titleKey: "ProfileTemplateDefault.promotionDialog.title",
      descriptionKey: "ProfileTemplateDefault.promotionDialog.description",
      confirmKey: "ProfileTemplateDefault.promotionDialog.confirm",
      cancelKey: "ProfileTemplateDefault.promotionDialog.cancel",
    },
  },
  adminRequestPending: {
    id: "adminPending",
    type: "pending",
    icon: "clock",
    variant: "outline",
    requiresConfirmation: false,
    i18nKey: "ProfileTemplateDefault.adminRequestPending",
  },

  // ============ INVITATIONS (Accept/Reject) ============
  acceptInvitation: {
    id: "acceptInvitation",
    type: "accept",
    icon: "check",
    variant: "default",
    requiresConfirmation: false,
    i18nKey: "ProfileTemplateDefault.acceptInvitation",
  },
  acceptAdminInvitation: {
    id: "acceptAdminInvitation",
    type: "accept",
    icon: "check",
    variant: "default",
    requiresConfirmation: false,
    i18nKey: "ProfileTemplateDefault.acceptAdminInvitation",
  },
  rejectInvitation: {
    id: "rejectInvitation",
    type: "reject",
    icon: "x",
    variant: "outline",
    requiresConfirmation: true,
    i18nKey: "ProfileTemplateDefault.rejectInvitation",
    confirmation: {
      titleKey: "ProfileTemplateDefault.rejectInvitationDialog.title",
      descriptionKey: "ProfileTemplateDefault.rejectInvitationDialog.description",
      confirmKey: "ProfileTemplateDefault.rejectInvitationDialog.confirm",
      cancelKey: "ProfileTemplateDefault.rejectInvitationDialog.cancel",
    },
  },
} as const satisfies Record<string, EntityActionConfig>;

export type EntityActionConfigKey = keyof typeof ENTITY_ACTION_CONFIG;
