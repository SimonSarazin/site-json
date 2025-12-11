/**
 * Hook pour les actions sur les profils utilisateurs (citoyens)
 * Gère follow/unfollow et les demandes d'amitié
 */
import { useMemo } from "react";
import type { User } from "@communecter/cocolight-api-client";
import { isUser } from "@/lib/getTypedEntity";
import { useT } from "@/hooks/useT";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { useCocolight } from "@/hooks/useCocolight";
import { useFollowEntity, useUnfollowEntity } from "../mutations/relationship";
import {
  useSendFriendRequest,
  useRemoveFriend,
  useAcceptFriendRequest,
  useRejectFriendRequest,
  useCancelFriendRequest,
} from "../mutations/friend";
import { buildEntityAction, buildPendingAction, buildEntityActionWithParams } from "../builders/buildEntityAction";
import type { EntityAction, EntityActionsResult } from "../../types";

/**
 * Hook pour les actions disponibles sur un profil utilisateur
 *
 * @param entity - L'utilisateur (ou null si pas un User)
 * @returns Actions et layout pour le profil utilisateur
 */
export function useUserEntityActions(entity: User | null): EntityActionsResult | null {
  const t = useT("modules/profil");
  const permissions = useUserPermissions(entity);
  const { me } = useCocolight();
  const currentUser = me && isUser(me) ? (me as User) : null;

  // Mutations relationship
  const followMutation = useFollowEntity(entity);
  const unfollowMutation = useUnfollowEntity(entity);

  // Mutations friend
  const sendFriendRequestMutation = useSendFriendRequest(currentUser);
  const removeFriendMutation = useRemoveFriend(currentUser);
  const acceptFriendMutation = useAcceptFriendRequest(currentUser);
  const rejectFriendMutation = useRejectFriendRequest(currentUser);
  const cancelFriendMutation = useCancelFriendRequest(currentUser);

  return useMemo(() => {
    if (!entity) return null;

    const actions: EntityAction[] = [];

    // ============ FOLLOW / UNFOLLOW ============
    if (permissions.canFollow && !permissions.isFriend) {
      if (permissions.isFollowing) {
        actions.push(
          buildEntityAction({
            configKey: "unfollow",
            t,
            mutation: unfollowMutation,
            iconMargin: false,
            overrides: { requiresConfirmation: false }, // Pas de confirmation pour unfollow user
          })
        );
      } else {
        actions.push(
          buildEntityAction({
            configKey: "follow",
            t,
            mutation: followMutation,
            iconMargin: false,
          })
        );
      }
    }

    // ============ FRIEND ACTIONS ============
    if (permissions.isFriend) {
      // Déjà ami → Bouton "Retirer des amis"
      actions.push(
        buildEntityActionWithParams({
          configKey: "removeFriend",
          t,
          mutation: removeFriendMutation,
          params: { user: entity },
          iconMargin: false,
        })
      );
    } else if (permissions.hasReceivedFriendRequest) {
      // Demande reçue → Accepter / Refuser
      actions.push(
        buildEntityActionWithParams({
          configKey: "acceptFriendRequest",
          t,
          mutation: acceptFriendMutation,
          params: { user: entity },
          iconMargin: false,
        })
      );
      actions.push(
        buildEntityActionWithParams({
          configKey: "rejectFriendRequest",
          t,
          mutation: rejectFriendMutation,
          params: { user: entity },
          iconMargin: false,
        })
      );
    } else if (permissions.hasSentFriendRequest) {
      // Demande envoyée → Badge "Demande envoyée" + Annuler
      actions.push(
        buildPendingAction({
          configKey: "friendRequestPending",
          t,
          iconMargin: false,
        })
      );
      actions.push(
        buildEntityActionWithParams({
          configKey: "cancelFriendRequest",
          t,
          mutation: cancelFriendMutation,
          params: { user: entity },
          iconMargin: false,
        })
      );
    } else if (permissions.canSendFriendRequest) {
      // Peut envoyer une demande
      actions.push(
        buildEntityActionWithParams({
          configKey: "sendFriendRequest",
          t,
          mutation: sendFriendRequestMutation,
          params: { user: entity },
          iconMargin: false,
        })
      );
    }

    if (actions.length === 0) return null;

    return {
      actions,
      layout: "separate-buttons",
    };
  }, [
    entity,
    permissions,
    t,
    followMutation,
    unfollowMutation,
    sendFriendRequestMutation,
    removeFriendMutation,
    acceptFriendMutation,
    rejectFriendMutation,
    cancelFriendMutation,
  ]);
}
