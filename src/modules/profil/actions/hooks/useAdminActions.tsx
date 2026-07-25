/**
 * Hook pour les actions admin sur les membres d'une entité
 * Remplace useUserActions.tsx avec une architecture basée sur les builders
 */
import { useT } from "@/hooks/useT";
import { isOrganization, isProject, isEvent, isUser } from "@/lib/getTypedEntity";
import type { User, Organization, EntityTypes } from "@communecter/cocolight-api-client";
import {
  usePromoteMember,
  useDemoteMember,
  useRemoveMember,
  useValidateMember,
  useValidateAdmin,
  useRejectMember,
  useInviteMember,
  useInviteAdmin,
} from "../mutations/member";
import {
  buildUserAction,
  buildDisabledUserAction,
  buildInviteAction,
} from "../builders/buildUserAction";
import type { UserAction } from "../../types";

type ShowConfirmationFn = (config: {
  title: string;
  description: string;
  action: () => void;
  isDestructive?: boolean;
}) => void;

/**
 * Hook pour obtenir les actions admin disponibles pour un utilisateur membre
 *
 * @param entity - L'entité parente (organisation/projet/événement)
 * @param showConfirmation - Fonction pour afficher les dialogues de confirmation
 */
export function useAdminActions(
  entity: EntityTypes | null,
  showConfirmation: ShowConfirmationFn
) {
  const t = useT("modules/profil");

  // Mutations - passent l'entité parente pour invalider correctement les queries
  const promoteMutation = usePromoteMember(entity);
  const demoteMutation = useDemoteMember(entity);
  const removeMutation = useRemoveMember(entity);
  const validateMutation = useValidateMember(entity);
  const validateAdminMutation = useValidateAdmin(entity);
  const rejectMutation = useRejectMember(entity);
  const inviteMemberMutation = useInviteMember(entity);
  const inviteAdminMutation = useInviteAdmin(entity);

  /**
   * Construit les actions disponibles pour un utilisateur selon son statut
   */
  const getUserActionButtons = (user: User | Organization): UserAction[] => {
    const actions: UserAction[] = [];

    if (!entity || !isUser(user)) return actions;

    // === ORGANISATION ===
    if (isOrganization(entity)) {
      // Admin d'organisation
      if (user.isAdmin?.()) {
        actions.push(
          buildUserAction({ configKey: "demote", t, mutation: demoteMutation, user, showConfirmation }),
          buildUserAction({ configKey: "remove", t, mutation: removeMutation, user, showConfirmation })
        );
        return actions;
      }

      // Membre d'organisation
      if (user.isMember?.()) {
        actions.push(
          buildUserAction({ configKey: "promote", t, mutation: promoteMutation, user, showConfirmation }),
          buildUserAction({ configKey: "remove", t, mutation: removeMutation, user, showConfirmation })
        );
        return actions;
      }

      // États d'invitation/validation
      if (user.isInvitingAdmin?.()) {
        return [buildDisabledUserAction({ configKey: "invitingAdmin", t })];
      }

      if (user.isAdminPending?.()) {
        actions.push(
          buildUserAction({ configKey: "validateAdmin", t, mutation: validateAdminMutation, user, showConfirmation }),
          buildUserAction({ configKey: "reject", t, mutation: rejectMutation, user, showConfirmation })
        );
        return actions;
      }

      if (user.isInviting?.()) {
        return [buildDisabledUserAction({ configKey: "inviting", t })];
      }

      if (user.isToBeValidated?.()) {
        actions.push(
          buildUserAction({ configKey: "validate", t, mutation: validateMutation, user, showConfirmation }),
          buildUserAction({ configKey: "reject", t, mutation: rejectMutation, user, showConfirmation })
        );
        return actions;
      }
    }

    // === PROJET ===
    if (isProject(entity)) {
      // Admin de projet
      if (user.isAdmin?.()) {
        actions.push(
          buildUserAction({ configKey: "demote", t, mutation: demoteMutation, user, showConfirmation }),
          buildUserAction({ configKey: "remove", t, mutation: removeMutation, user, showConfirmation })
        );
        return actions;
      }

      // Contributeur de projet
      if (user.isContributor?.()) {
        actions.push(
          buildUserAction({ configKey: "promote", t, mutation: promoteMutation, user, showConfirmation }),
          buildUserAction({ configKey: "remove", t, mutation: removeMutation, user, showConfirmation })
        );
        return actions;
      }

      // États d'invitation/validation
      if (user.isInvitingAdmin?.()) {
        return [buildDisabledUserAction({ configKey: "invitingAdmin", t })];
      }

      if (user.isAdminPending?.()) {
        actions.push(
          buildUserAction({ configKey: "validateAdmin", t, mutation: validateAdminMutation, user, showConfirmation }),
          buildUserAction({ configKey: "reject", t, mutation: rejectMutation, user, showConfirmation })
        );
        return actions;
      }

      if (user.isInviting?.()) {
        return [buildDisabledUserAction({ configKey: "inviting", t })];
      }

      if (user.isToBeValidated?.()) {
        actions.push(
          buildUserAction({ configKey: "validate", t, mutation: validateMutation, user, showConfirmation }),
          buildUserAction({ configKey: "reject", t, mutation: rejectMutation, user, showConfirmation })
        );
        return actions;
      }
    }

    // === ÉVÉNEMENT ===
    if (isEvent(entity)) {
      // Participant d'événement
      if (user.isAttendee?.()) {
        actions.push(
          buildUserAction({ configKey: "remove", t, mutation: removeMutation, user, showConfirmation })
        );
        return actions;
      }

      // États d'invitation/validation
      if (user.isInviting?.()) {
        return [buildDisabledUserAction({ configKey: "inviting", t })];
      }

      if (user.isToBeValidated?.()) {
        actions.push(
          buildUserAction({ configKey: "validate", t, mutation: validateMutation, user, showConfirmation }),
          buildUserAction({ configKey: "reject", t, mutation: rejectMutation, user, showConfirmation })
        );
        return actions;
      }
    }

    // === ACTIONS D'INVITATION (utilisateur non-membre) ===
    if (isOrganization(entity)) {
      actions.push(
        buildInviteAction({ configKey: "inviteMember", t, mutation: inviteMemberMutation, user }),
        buildInviteAction({ configKey: "inviteAdmin", t, mutation: inviteAdminMutation, user })
      );
    } else if (isProject(entity)) {
      actions.push(
        buildInviteAction({ configKey: "inviteContributor", t, mutation: inviteMemberMutation, user }),
        buildInviteAction({ configKey: "inviteAdmin", t, mutation: inviteAdminMutation, user })
      );
    } else if (isEvent(entity)) {
      actions.push(
        buildInviteAction({ configKey: "inviteParticipant", t, mutation: inviteMemberMutation, user })
      );
    }

    return actions;
  };

  return { getUserActionButtons };
}
