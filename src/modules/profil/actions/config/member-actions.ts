/**
 * Configuration déclarative des actions admin sur les membres
 * Utilisé par useUserActions pour les listes de membres
 */
import type { ActionIconKey } from "./icons";
import type { UserAction } from "../../types";

type ActionVariant = UserAction["variant"];

export interface MemberActionConfig {
  id: string;
  icon: ActionIconKey;
  variant: ActionVariant;
  i18nKey: string;
  requiresConfirmation?: boolean;
  confirmation?: {
    titleKey: string;
    descriptionKey: string; // Utilise {name} comme placeholder
  };
  isDestructive?: boolean;
}

/**
 * Configuration des actions disponibles sur les membres d'une entité
 * Utilisé par buildUserAction pour générer les objets UserAction
 */
export const MEMBER_ACTION_CONFIG = {
  // ============ ADMIN MANAGEMENT ============
  promote: {
    id: "promote",
    icon: "crown",
    variant: "outline",
    i18nKey: "InviteMemberDialog.promoteToAdmin",
    requiresConfirmation: true,
    confirmation: {
      titleKey: "InviteMemberDialog.promoteDialog.title",
      descriptionKey: "InviteMemberDialog.promoteDialog.description",
    },
  },
  demote: {
    id: "demote",
    icon: "shieldOff",
    variant: "outline",
    i18nKey: "InviteMemberDialog.demote",
    requiresConfirmation: true,
    confirmation: {
      titleKey: "InviteMemberDialog.demoteDialog.title",
      descriptionKey: "InviteMemberDialog.demoteDialog.description",
    },
  },
  remove: {
    id: "remove",
    icon: "trash",
    variant: "destructive",
    i18nKey: "InviteMemberDialog.remove",
    requiresConfirmation: true,
    confirmation: {
      titleKey: "InviteMemberDialog.removeDialog.title",
      descriptionKey: "InviteMemberDialog.removeDialog.description",
    },
    isDestructive: true,
  },

  // ============ VALIDATION ============
  validate: {
    id: "validate",
    icon: "check",
    variant: "default",
    i18nKey: "InviteMemberDialog.validate",
    requiresConfirmation: true,
    confirmation: {
      titleKey: "InviteMemberDialog.validateDialog.title",
      descriptionKey: "InviteMemberDialog.validateDialog.description",
    },
  },
  validateAdmin: {
    id: "validate-admin",
    icon: "crown",
    variant: "default",
    i18nKey: "InviteMemberDialog.validateAdmin",
    requiresConfirmation: true,
    confirmation: {
      titleKey: "InviteMemberDialog.validateAdminDialog.title",
      descriptionKey: "InviteMemberDialog.validateAdminDialog.description",
    },
  },
  reject: {
    id: "reject",
    icon: "x",
    variant: "destructive",
    i18nKey: "InviteMemberDialog.reject",
    requiresConfirmation: true,
    confirmation: {
      titleKey: "InviteMemberDialog.rejectDialog.title",
      descriptionKey: "InviteMemberDialog.rejectDialog.description",
    },
    isDestructive: true,
  },

  // ============ INVITATIONS ============
  inviteMember: {
    id: "invite-member",
    icon: "userPlus",
    variant: "default",
    i18nKey: "InviteMemberDialog.inviteMember",
    requiresConfirmation: false,
  },
  inviteContributor: {
    id: "invite-contributor",
    icon: "userPlus",
    variant: "default",
    i18nKey: "InviteMemberDialog.inviteContributor",
    requiresConfirmation: false,
  },
  inviteParticipant: {
    id: "invite-participant",
    icon: "userPlus",
    variant: "default",
    i18nKey: "InviteMemberDialog.inviteParticipant",
    requiresConfirmation: false,
  },
  inviteAdmin: {
    id: "invite-admin",
    icon: "crown",
    variant: "outline",
    i18nKey: "InviteMemberDialog.inviteAdmin",
    requiresConfirmation: false,
  },

  // ============ STATUS BADGES (disabled) ============
  invitingAdmin: {
    id: "inviting-admin",
    icon: "crown",
    variant: "secondary",
    i18nKey: "InviteMemberDialog.adminInvitationSent",
    requiresConfirmation: false,
  },
  inviting: {
    id: "inviting",
    icon: "mail",
    variant: "secondary",
    i18nKey: "InviteMemberDialog.invited",
    requiresConfirmation: false,
  },
} as const satisfies Record<string, MemberActionConfig>;

export type MemberActionConfigKey = keyof typeof MEMBER_ACTION_CONFIG;
