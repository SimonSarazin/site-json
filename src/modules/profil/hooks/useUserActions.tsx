import React from "react";
import { useT } from "@/hooks/useT";
import { isOrganization, isProject, isEvent, isUser } from "@/lib/getTypedEntity";
import type { User, Organization, EntityTypes } from "@communecter/cocolight-api-client";
import {
  useDemoteMember,
  usePromoteMember,
  useRemoveMember,
  useValidateMember,
  useValidateAdmin,
  useRejectMember
} from "./useMemberMutations";
import { useInviteMember, useInviteAdmin } from "./useInviteMutations";
import { ShieldOff, Crown, Trash2, Check, X, UserPlus, Mail } from "lucide-react";

export interface UserAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  variant: "default" | "outline" | "destructive" | "secondary";
  onClick: () => void;
  disabled?: boolean;
  requiresConfirmation?: boolean;
}

/**
 * Hook pour obtenir les actions disponibles pour un utilisateur
 * Basé sur getUserActionButtons d'InviteMemberDialog (version complète)
 *
 * @param entity - L'entité parente (organisation/projet/événement)
 * @param showConfirmation - Fonction pour afficher les dialogues de confirmation
 */

export function useUserActions(
  entity: EntityTypes | null,
  showConfirmation: (config: { title: string; description: string; action: () => void; isDestructive?: boolean }) => void
) {
  const t = useT("modules/profil");

  // Hooks de mutations
  const demoteMember = useDemoteMember(entity);
  const promoteMember = usePromoteMember(entity);
  const removeMember = useRemoveMember(entity);
  const validateMember = useValidateMember(entity);
  const validateAdmin = useValidateAdmin(entity);
  const rejectMember = useRejectMember(entity);
  const inviteMember = useInviteMember(entity);
  const inviteAdmin = useInviteAdmin(entity);

  const getUserActionButtons = (user: User | Organization): UserAction[] => {
    const actions: UserAction[] = [];
    const userName = user.serverData?.name || "Unknown";

    if (!entity || !isUser(user)) return actions;

    // Actions spécifiques selon le type d'entité
    if (isOrganization(entity)) {
      // Admin d'organisation
      if (user.isAdmin?.()) {
        actions.push({
          id: "demote",
          label: t("InviteMemberDialog.demote"),
          icon: <ShieldOff className="w-3 h-3" />,
          variant: "outline",
          onClick: () => showConfirmation({
            title: t("InviteMemberDialog.demoteDialog.title"),
            description: t("InviteMemberDialog.demoteDialog.description", undefined, { name: userName }),
            action: () => demoteMember.mutate(user)
          }),
          requiresConfirmation: true
        });

        actions.push({
          id: "remove",
          label: t("InviteMemberDialog.remove"),
          icon: <Trash2 className="w-3 h-3" />,
          variant: "destructive",
          onClick: () => showConfirmation({
            title: t("InviteMemberDialog.removeDialog.title"),
            description: t("InviteMemberDialog.removeDialog.description", undefined, { name: userName }),
            action: () => removeMember.mutate(user),
            isDestructive: true
          }),
          requiresConfirmation: true
        });

        return actions;
      }

      // Membre d'organisation
      if (user.isMember?.()) {
        actions.push({
          id: "promote",
          label: t("InviteMemberDialog.promoteToAdmin"),
          icon: <Crown className="w-3 h-3" />,
          variant: "outline",
          onClick: () => showConfirmation({
            title: t("InviteMemberDialog.promoteDialog.title"),
            description: t("InviteMemberDialog.promoteDialog.description", undefined, { name: userName }),
            action: () => promoteMember.mutate(user)
          }),
          requiresConfirmation: true
        });

        actions.push({
          id: "remove",
          label: t("InviteMemberDialog.remove"),
          icon: <Trash2 className="w-3 h-3" />,
          variant: "destructive",
          onClick: () => showConfirmation({
            title: t("InviteMemberDialog.removeDialog.title"),
            description: t("InviteMemberDialog.removeDialog.description", undefined, { name: userName }),
            action: () => removeMember.mutate(user),
            isDestructive: true
          }),
          requiresConfirmation: true
        });

        return actions;
      }

      // États d'invitation/validation pour organisations
      if (user.isInvitingAdmin?.()) {
        return [{
          id: "inviting-admin",
          label: t("InviteMemberDialog.adminInvitationSent"),
          icon: <Crown className="w-3 h-3" />,
          variant: "secondary",
          onClick: () => {},
          disabled: true
        }];
      }

      if (user.isAdminPending?.()) {
        actions.push({
          id: "validate-admin",
          label: t("InviteMemberDialog.validateAdmin"),
          icon: <Crown className="w-3 h-3" />,
          variant: "default",
          onClick: () => showConfirmation({
            title: t("InviteMemberDialog.validateAdminDialog.title"),
            description: t("InviteMemberDialog.validateAdminDialog.description", undefined, { name: userName }),
            action: () => validateAdmin.mutate(user)
          }),
          requiresConfirmation: true
        });

        return actions;
      }

      if (user.isInviting?.()) {
        return [{
          id: "inviting",
          label: t("InviteMemberDialog.invited"),
          icon: <Mail className="w-3 h-3" />,
          variant: "secondary",
          onClick: () => {},
          disabled: true
        }];
      }

      if (user.isToBeValidated?.()) {
        actions.push({
          id: "validate",
          label: t("InviteMemberDialog.validate"),
          icon: <Check className="w-3 h-3" />,
          variant: "default",
          onClick: () => showConfirmation({
            title: t("InviteMemberDialog.validateDialog.title"),
            description: t("InviteMemberDialog.validateDialog.description", undefined, { name: userName }),
            action: () => validateMember.mutate(user)
          }),
          requiresConfirmation: true
        });

        actions.push({
          id: "reject",
          label: t("InviteMemberDialog.reject"),
          icon: <X className="w-3 h-3" />,
          variant: "destructive",
          onClick: () => showConfirmation({
            title: t("InviteMemberDialog.rejectDialog.title"),
            description: t("InviteMemberDialog.rejectDialog.description", undefined, { name: userName }),
            action: () => rejectMember.mutate(user),
            isDestructive: true
          }),
          requiresConfirmation: true
        });

        return actions;
      }
    } else if (isProject(entity)) {
      // Admin de projet
      if (user.isAdmin?.()) {
        actions.push({
          id: "demote",
          label: t("InviteMemberDialog.demote"),
          icon: <ShieldOff className="w-3 h-3" />,
          variant: "outline",
          onClick: () => showConfirmation({
            title: t("InviteMemberDialog.demoteDialog.title"),
            description: t("InviteMemberDialog.demoteDialog.description", undefined, { name: userName }),
            action: () => demoteMember.mutate(user)
          }),
          requiresConfirmation: true
        });

        actions.push({
          id: "remove",
          label: t("InviteMemberDialog.remove"),
          icon: <Trash2 className="w-3 h-3" />,
          variant: "destructive",
          onClick: () => showConfirmation({
            title: t("InviteMemberDialog.removeDialog.title"),
            description: t("InviteMemberDialog.removeDialog.description", undefined, { name: userName }),
            action: () => removeMember.mutate(user),
            isDestructive: true
          }),
          requiresConfirmation: true
        });

        return actions;
      }

      // Contributeur de projet
      if (user.isContributor?.()) {
        actions.push({
          id: "promote",
          label: t("InviteMemberDialog.promoteToAdmin"),
          icon: <Crown className="w-3 h-3" />,
          variant: "outline",
          onClick: () => showConfirmation({
            title: t("InviteMemberDialog.promoteDialog.title"),
            description: t("InviteMemberDialog.promoteDialog.description", undefined, { name: userName }),
            action: () => promoteMember.mutate(user)
          }),
          requiresConfirmation: true
        });

        actions.push({
          id: "remove",
          label: t("InviteMemberDialog.remove"),
          icon: <Trash2 className="w-3 h-3" />,
          variant: "destructive",
          onClick: () => showConfirmation({
            title: t("InviteMemberDialog.removeDialog.title"),
            description: t("InviteMemberDialog.removeDialog.description", undefined, { name: userName }),
            action: () => removeMember.mutate(user),
            isDestructive: true
          }),
          requiresConfirmation: true
        });

        return actions;
      }

      // États d'invitation/validation pour projets
      if (user.isInvitingAdmin?.()) {
        return [{
          id: "inviting-admin",
          label: t("InviteMemberDialog.adminInvitationSent"),
          icon: <Crown className="w-3 h-3" />,
          variant: "secondary",
          onClick: () => {},
          disabled: true
        }];
      }

      if (user.isAdminPending?.()) {
        actions.push({
          id: "validate-admin",
          label: t("InviteMemberDialog.validateAdmin"),
          icon: <Crown className="w-3 h-3" />,
          variant: "default",
          onClick: () => showConfirmation({
            title: t("InviteMemberDialog.validateAdminDialog.title"),
            description: t("InviteMemberDialog.validateAdminDialog.description", undefined, { name: userName }),
            action: () => validateAdmin.mutate(user)
          }),
          requiresConfirmation: true
        });

        return actions;
      }

      if (user.isInviting?.()) {
        return [{
          id: "inviting",
          label: t("InviteMemberDialog.invited"),
          icon: <Mail className="w-3 h-3" />,
          variant: "secondary",
          onClick: () => {},
          disabled: true
        }];
      }

      if (user.isToBeValidated?.()) {
        actions.push({
          id: "validate",
          label: t("InviteMemberDialog.validate"),
          icon: <Check className="w-3 h-3" />,
          variant: "default",
          onClick: () => showConfirmation({
            title: t("InviteMemberDialog.validateDialog.title"),
            description: t("InviteMemberDialog.validateDialog.description", undefined, { name: userName }),
            action: () => validateMember.mutate(user)
          }),
          requiresConfirmation: true
        });

        actions.push({
          id: "reject",
          label: t("InviteMemberDialog.reject"),
          icon: <X className="w-3 h-3" />,
          variant: "destructive",
          onClick: () => showConfirmation({
            title: t("InviteMemberDialog.rejectDialog.title"),
            description: t("InviteMemberDialog.rejectDialog.description", undefined, { name: userName }),
            action: () => rejectMember.mutate(user),
            isDestructive: true
          }),
          requiresConfirmation: true
        });

        return actions;
      }
    } else if (isEvent(entity)) {
      // Participant d'événement
      if (user.isAttendee?.()) {
        actions.push({
          id: "remove",
          label: t("InviteMemberDialog.remove"),
          icon: <Trash2 className="w-3 h-3" />,
          variant: "destructive",
          onClick: () => showConfirmation({
            title: t("InviteMemberDialog.removeDialog.title"),
            description: t("InviteMemberDialog.removeDialog.description", undefined, { name: userName }),
            action: () => removeMember.mutate(user),
            isDestructive: true
          }),
          requiresConfirmation: true
        });

        return actions;
      }

      // États d'invitation/validation pour événements
      if (user.isInviting?.()) {
        return [{
          id: "inviting",
          label: t("InviteMemberDialog.invited"),
          icon: <Mail className="w-3 h-3" />,
          variant: "secondary",
          onClick: () => {},
          disabled: true
        }];
      }

      if (user.isToBeValidated?.()) {
        actions.push({
          id: "validate",
          label: t("InviteMemberDialog.validate"),
          icon: <Check className="w-3 h-3" />,
          variant: "default",
          onClick: () => showConfirmation({
            title: t("InviteMemberDialog.validateDialog.title"),
            description: t("InviteMemberDialog.validateDialog.description", undefined, { name: userName }),
            action: () => validateMember.mutate(user)
          }),
          requiresConfirmation: true
        });

        actions.push({
          id: "reject",
          label: t("InviteMemberDialog.reject"),
          icon: <X className="w-3 h-3" />,
          variant: "destructive",
          onClick: () => showConfirmation({
            title: t("InviteMemberDialog.rejectDialog.title"),
            description: t("InviteMemberDialog.rejectDialog.description", undefined, { name: userName }),
            action: () => rejectMember.mutate(user),
            isDestructive: true
          }),
          requiresConfirmation: true
        });

        return actions;
      }
    }

    // Utilisateur normal - actions d'invitation (dernier recours)
    if (isOrganization(entity)) {
      actions.push({
        id: "invite-member",
        label: t("InviteMemberDialog.inviteMember"),
        icon: <UserPlus className="w-3 h-3" />,
        variant: "default",
        onClick: () => inviteMember.mutate(user)
      });

      actions.push({
        id: "invite-admin",
        label: t("InviteMemberDialog.inviteAdmin"),
        icon: <Crown className="w-3 h-3" />,
        variant: "outline",
        onClick: () => inviteAdmin.mutate(user)
      });
    } else if (isProject(entity)) {
      actions.push({
        id: "invite-contributor",
        label: t("InviteMemberDialog.inviteContributor"),
        icon: <UserPlus className="w-3 h-3" />,
        variant: "default",
        onClick: () => inviteMember.mutate(user)
      });

      actions.push({
        id: "invite-admin",
        label: t("InviteMemberDialog.inviteAdmin"),
        icon: <Crown className="w-3 h-3" />,
        variant: "outline",
        onClick: () => inviteAdmin.mutate(user)
      });
    } else if (isEvent(entity)) {
      actions.push({
        id: "invite-participant",
        label: t("InviteMemberDialog.inviteParticipant"),
        icon: <UserPlus className="w-3 h-3" />,
        variant: "default",
        onClick: () => inviteMember.mutate(user)
      });
    }

    return actions;
  };

  return { getUserActionButtons };
}