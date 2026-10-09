/**
 * Hook pour les actions sur les profils d'organisations
 * Gère follow, membership, invitations, et leave
 */
import { useMemo } from "react";
import type { Organization } from "@communecter/cocolight-api-client";
import { useNavigate } from "react-router";
import { useT } from "@/hooks/useT";
import { useProfilPermissions } from "../../hooks/useProfilPermissions";
import { UserPlus, UserCheck } from "lucide-react";
import {
  useFollowEntity,
  useUnfollowEntity,
  useRequestToJoin,
  useRequestToJoinAdmin,
  useLeaveEntity,
  useAcceptInvitation,
  useRejectInvitation,
  useRequestPromoteToAdmin,
} from "../mutations/relationship";
import { useDeleteEntity } from "../mutations/deleteEntity";
import { buildEntityAction, buildPendingAction } from "../builders/buildEntityAction";
import type { EntityAction, EntityActionsResult, EntityActionsOptions } from "../../types";

/**
 * Hook pour les actions disponibles sur un profil d'organisation
 *
 * @param entity - L'organisation (ou null si pas une Organization)
 * @param options - Actions que la SECTION autorise en plus (suppression de la fiche) — jamais un
 *   défaut du moteur : une suppression définitive ne s'offre que là où un site l'a demandée.
 * @returns Actions et layout pour le profil organization
 */
export function useOrgEntityActions(
  entity: Organization | null,
  options: EntityActionsOptions = {},
): EntityActionsResult | null {
  const t = useT("modules/profil");
  const navigate = useNavigate();
  const permissions = useProfilPermissions(entity);
  const { allowDelete = false, deleteRedirectPath = "/" } = options;

  // Mutations
  const followMutation = useFollowEntity(entity);
  const unfollowMutation = useUnfollowEntity(entity);
  const requestMembershipMutation = useRequestToJoin(entity);
  const requestAdminMutation = useRequestToJoinAdmin(entity);
  const leaveMutation = useLeaveEntity(entity);
  const acceptInvitationMutation = useAcceptInvitation(entity);
  const rejectInvitationMutation = useRejectInvitation(entity);
  const requestPromotionMutation = useRequestPromoteToAdmin(entity);
  const deleteMutation = useDeleteEntity(entity);

  return useMemo(() => {
    if (!entity) return null;

    const actions: EntityAction[] = [];

    // Déterminer le statut pour le bouton principal
    let statusLabel = t("ProfileTemplateDefault.follow");
    let statusIcon = <UserPlus className="w-4 h-4 mr-2" />;
    let statusVariant: "default" | "outline" = "outline";

    if (permissions.isAdmin) {
      statusLabel = t("ProfileTemplateDefault.admin");
      statusIcon = <UserCheck className="w-4 h-4 mr-2" />;
      statusVariant = "default";
    } else if (permissions.isMember) {
      statusLabel = t("ProfileTemplateDefault.member");
      statusIcon = <UserCheck className="w-4 h-4 mr-2" />;
      statusVariant = "default";
    } else if (permissions.isFollowing) {
      statusLabel = t("ProfileTemplateDefault.following");
      statusIcon = <UserCheck className="w-4 h-4 mr-2" />;
      statusVariant = "outline";
    }

    // ============ FOLLOW / UNFOLLOW ============
    if (permissions.canFollow) {
      if (permissions.isFollowing) {
        actions.push(buildEntityAction({ configKey: "unfollow", t, mutation: unfollowMutation }));
      } else {
        actions.push(buildEntityAction({ configKey: "follow", t, mutation: followMutation }));
      }
    }

    // ============ MEMBERSHIP ============
    if (permissions.canRequestMembership) {
      actions.push(buildEntityAction({ configKey: "requestMembership", t, mutation: requestMembershipMutation }));
    }

    if (permissions.canRequestOrganizationAdmin) {
      actions.push(buildEntityAction({ configKey: "requestOrganizationAdmin", t, mutation: requestAdminMutation }));
    }

    // ============ PENDING STATES ============
    if (permissions.isToBeValidated) {
      actions.push(buildPendingAction({ configKey: "membershipPending", t }));
    }

    if (permissions.isAdminPending) {
      actions.push(buildPendingAction({ configKey: "adminRequestPending", t }));
    }

    // ============ INVITATIONS ============
    if (permissions.isInviting) {
      actions.push(buildEntityAction({ configKey: "acceptInvitation", t, mutation: acceptInvitationMutation }));
      actions.push(buildEntityAction({ configKey: "rejectInvitation", t, mutation: rejectInvitationMutation }));
    }

    if (permissions.isInvitingAdmin) {
      actions.push(buildEntityAction({ configKey: "acceptAdminInvitation", t, mutation: acceptInvitationMutation }));
      actions.push(buildEntityAction({ configKey: "rejectInvitation", t, mutation: rejectInvitationMutation }));
    }

    // ============ PROMOTION ============
    if (permissions.canRequestPromotion) {
      actions.push(buildEntityAction({ configKey: "requestPromotion", t, mutation: requestPromotionMutation }));
    }

    // ============ LEAVE ============
    if (permissions.isMember || permissions.isAdmin) {
      actions.push(buildEntityAction({ configKey: "leaveOrganization", t, mutation: leaveMutation }));
    }

    // ============ SUPPRESSION DÉFINITIVE ============
    // Deux conditions, jamais une seule : le site l'a ouverte (`allowDelete`) ET le compte est
    // ADMIN de cette fiche. La redirection se fait en `onSuccess` du mutate — la page de la fiche
    // n'existe plus une fois la suppression passée.
    if (allowDelete && permissions.isAdmin) {
      actions.push(
        buildEntityAction({
          configKey: "deleteEntity",
          t,
          mutation: deleteMutation,
          overrides: {
            onClick: () =>
              deleteMutation.mutate(undefined, { onSuccess: () => navigate(deleteRedirectPath) }),
          },
        }),
      );
    }

    if (actions.length === 0 && !permissions.canFollow && !permissions.canRequestMembership && !permissions.isMember) {
      return null;
    }

    return {
      actions,
      layout: "status-dropdown",
      statusLabel,
      statusIcon,
      statusVariant,
    };
  }, [
    entity,
    permissions,
    t,
    followMutation,
    unfollowMutation,
    requestMembershipMutation,
    requestAdminMutation,
    leaveMutation,
    acceptInvitationMutation,
    rejectInvitationMutation,
    requestPromotionMutation,
    deleteMutation,
    allowDelete,
    deleteRedirectPath,
    navigate,
  ]);
}
