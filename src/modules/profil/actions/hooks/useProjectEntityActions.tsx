/**
 * Hook pour les actions sur les profils de projets
 * Gère follow, contributor, invitations, et leave
 */
import { useMemo } from "react";
import type { Project } from "@communecter/cocolight-api-client";
import { useT } from "@/hooks/useT";
import { useUserPermissions } from "@/hooks/useUserPermissions";
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
import { buildEntityAction, buildPendingAction } from "../builders/buildEntityAction";
import type { EntityAction, EntityActionsResult } from "../../types";

/**
 * Hook pour les actions disponibles sur un profil de projet
 *
 * @param entity - Le projet (ou null si pas un Project)
 * @returns Actions et layout pour le profil project
 */
export function useProjectEntityActions(entity: Project | null): EntityActionsResult | null {
  const t = useT("modules/profil");
  const permissions = useUserPermissions(entity);

  // Mutations
  const followMutation = useFollowEntity(entity);
  const unfollowMutation = useUnfollowEntity(entity);
  const requestContributorMutation = useRequestToJoin(entity);
  const requestAdminMutation = useRequestToJoinAdmin(entity);
  const leaveMutation = useLeaveEntity(entity);
  const acceptInvitationMutation = useAcceptInvitation(entity);
  const rejectInvitationMutation = useRejectInvitation(entity);
  const requestPromotionMutation = useRequestPromoteToAdmin(entity);

  return useMemo(() => {
    if (!entity) return null;

    const actions: EntityAction[] = [];

    // Déterminer le statut pour le bouton principal
    let statusLabel = t("ProfileTemplateDefault.follow");
    let statusIcon = <UserPlus className="w-4 h-4 mr-2" />;
    let statusVariant: "default" | "outline" = "outline";

    if (permissions.isAdmin) {
      statusLabel = t("ProfileTemplateDefault.projectAdmin");
      statusIcon = <UserCheck className="w-4 h-4 mr-2" />;
      statusVariant = "default";
    } else if (permissions.isContributor) {
      statusLabel = t("ProfileTemplateDefault.contributor");
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

    // ============ CONTRIBUTOR ============
    if (permissions.canRequestContributor) {
      actions.push(buildEntityAction({ configKey: "requestContributor", t, mutation: requestContributorMutation }));
    }

    if (permissions.canRequestProjectAdmin) {
      actions.push(buildEntityAction({ configKey: "requestProjectAdmin", t, mutation: requestAdminMutation }));
    }

    // ============ PENDING STATES ============
    if (permissions.isToBeValidated) {
      actions.push(buildPendingAction({ configKey: "contributorPending", t }));
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
    if (permissions.isContributor || permissions.isAdmin) {
      actions.push(buildEntityAction({ configKey: "leaveProject", t, mutation: leaveMutation }));
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
    requestContributorMutation,
    requestAdminMutation,
    leaveMutation,
    acceptInvitationMutation,
    rejectInvitationMutation,
    requestPromotionMutation,
  ]);
}
