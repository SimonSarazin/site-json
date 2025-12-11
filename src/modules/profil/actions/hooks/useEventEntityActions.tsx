/**
 * Hook pour les actions sur les profils d'événements
 * Gère follow, participation, invitations, et leave
 */
import { useMemo } from "react";
import type { Event } from "@communecter/cocolight-api-client";
import { useT } from "@/hooks/useT";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { UserPlus, UserCheck } from "lucide-react";
import {
  useFollowEntity,
  useUnfollowEntity,
  useRequestToJoin,
  useLeaveEntity,
  useAcceptInvitation,
  useRejectInvitation,
} from "../mutations/relationship";
import { buildEntityAction, buildPendingAction } from "../builders/buildEntityAction";
import type { EntityAction, EntityActionsResult } from "../../types";

/**
 * Hook pour les actions disponibles sur un profil d'événement
 *
 * @param entity - L'événement (ou null si pas un Event)
 * @returns Actions et layout pour le profil event
 */
export function useEventEntityActions(entity: Event | null): EntityActionsResult | null {
  const t = useT("modules/profil");
  const permissions = useUserPermissions(entity);

  // Mutations
  const followMutation = useFollowEntity(entity);
  const unfollowMutation = useUnfollowEntity(entity);
  const participateMutation = useRequestToJoin(entity);
  const leaveMutation = useLeaveEntity(entity);
  const acceptInvitationMutation = useAcceptInvitation(entity);
  const rejectInvitationMutation = useRejectInvitation(entity);

  return useMemo(() => {
    if (!entity) return null;

    const actions: EntityAction[] = [];

    // Déterminer le statut pour le bouton principal
    let statusLabel = t("ProfileTemplateDefault.follow");
    let statusIcon = <UserPlus className="w-4 h-4 mr-2" />;
    let statusVariant: "default" | "outline" = "outline";

    if (permissions.isAuthor) {
      statusLabel = t("ProfileTemplateDefault.eventAuthor");
      statusIcon = <UserCheck className="w-4 h-4 mr-2" />;
      statusVariant = "default";
    } else if (permissions.isParticipant) {
      statusLabel = t("ProfileTemplateDefault.participant");
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

    // ============ PARTICIPATE ============
    if (permissions.canParticipate) {
      actions.push(buildEntityAction({ configKey: "participate", t, mutation: participateMutation }));
    }

    // ============ PENDING STATE ============
    if (permissions.isToBeValidated) {
      actions.push(buildPendingAction({ configKey: "participationPending", t }));
    }

    // ============ INVITATIONS ============
    if (permissions.isInviting) {
      actions.push(buildEntityAction({ configKey: "acceptInvitation", t, mutation: acceptInvitationMutation }));
      actions.push(buildEntityAction({ configKey: "rejectInvitation", t, mutation: rejectInvitationMutation }));
    }

    // ============ LEAVE ============
    if (permissions.isParticipant) {
      actions.push(buildEntityAction({ configKey: "leaveEvent", t, mutation: leaveMutation }));
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
    participateMutation,
    leaveMutation,
    acceptInvitationMutation,
    rejectInvitationMutation,
  ]);
}
