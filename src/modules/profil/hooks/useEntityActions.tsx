import { useMemo } from "react";
import type { EntityTypes, User } from "@communecter/cocolight-api-client";
import { isUser, isOrganization, isProject, isEvent } from "@/lib/getTypedEntity";
import { useT } from "@/hooks/useT";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { useCocolight } from "@/hooks/useCocolight";
import {
  useAcceptFriendRequest,
  useRejectFriendRequest,
  useCancelFriendRequest,
  useSendFriendRequest,
  useRemoveFriend,
} from "./useFriendMutations";
import {
  useFollowUser,
  useUnfollowUser,
  useFollowOrganization,
  useUnfollowOrganization,
  useRequestMembership,
  useRequestOrganizationAdmin,
  useLeaveOrganization,
  useAcceptOrgInvitation,
  useRejectOrgInvitation,
  useFollowProject,
  useUnfollowProject,
  useRequestContributor,
  useRequestProjectAdmin,
  useLeaveProject,
  useAcceptProjectInvitation,
  useRejectProjectInvitation,
  useFollowEvent,
  useUnfollowEvent,
  useParticipateEvent,
  useLeaveEvent,
  useAcceptEventInvitation,
  useRejectEventInvitation,
} from "./useRelationshipMutations";
import { useRequestPromoteToAdmin } from "./useMemberMutations";
import { UserPlus, UserMinus, UserCheck, UserX, Users, LogOut, Clock, Check, X } from "lucide-react";
import type { EntityAction, EntityActionsResult } from "../types";

export type { EntityAction, EntityActionsResult };

/**
 * Hook centralisé pour obtenir les actions disponibles sur une entité
 * Retourne les actions appropriées selon le type d'entité et les permissions
 *
 * @param entity - L'entité concernée (User, Organization, Project, Event)
 * @returns Configuration des actions et du layout
 */
export function useEntityActions(entity: EntityTypes | null): EntityActionsResult | null {
  const t = useT("modules/profil");
  const permissions = useUserPermissions(entity);
  const { me } = useCocolight();
  const currentUser = me && isUser(me) ? (me as User) : null;

  // Mutations pour Users
  const followUserMutation = useFollowUser(entity);
  const unfollowUserMutation = useUnfollowUser(entity);
  const sendFriendRequestMutation = useSendFriendRequest(currentUser);
  const removeFriendMutation = useRemoveFriend(currentUser);
  // Mutations pour demandes d'ami (accept/reject/cancel)
  const acceptFriendMutation = useAcceptFriendRequest(currentUser);
  const rejectFriendMutation = useRejectFriendRequest(currentUser);
  const cancelFriendMutation = useCancelFriendRequest(currentUser);

  // Mutations pour Organizations
  const followOrgMutation = useFollowOrganization(entity);
  const unfollowOrgMutation = useUnfollowOrganization(entity);
  const requestMembershipMutation = useRequestMembership(entity);
  const requestOrgAdminMutation = useRequestOrganizationAdmin(entity);
  const leaveOrgMutation = useLeaveOrganization(entity);
  const acceptOrgInvitationMutation = useAcceptOrgInvitation(entity);
  const rejectOrgInvitationMutation = useRejectOrgInvitation(entity);

  // Mutations pour Projects
  const followProjectMutation = useFollowProject(entity);
  const unfollowProjectMutation = useUnfollowProject(entity);
  const requestContributorMutation = useRequestContributor(entity);
  const requestProjectAdminMutation = useRequestProjectAdmin(entity);
  const leaveProjectMutation = useLeaveProject(entity);
  const acceptProjectInvitationMutation = useAcceptProjectInvitation(entity);
  const rejectProjectInvitationMutation = useRejectProjectInvitation(entity);
  const requestPromotionMutation = useRequestPromoteToAdmin(entity);

  // Mutations pour Events
  const followEventMutation = useFollowEvent(entity);
  const unfollowEventMutation = useUnfollowEvent(entity);
  const participateEventMutation = useParticipateEvent(entity);
  const leaveEventMutation = useLeaveEvent(entity);
  const acceptEventInvitationMutation = useAcceptEventInvitation(entity);
  const rejectEventInvitationMutation = useRejectEventInvitation(entity);

  return useMemo(() => {
    if (!entity) return null;

    // ============ USERS (citoyens) ============
    if (isUser(entity)) {
      const actions: EntityAction[] = [];

      // Action Follow/Unfollow
      if (permissions.canFollow && !permissions.isFriend) {
        if (permissions.isFollowing) {
          actions.push({
            id: "unfollow",
            type: "unfollow",
            label: t("ProfileTemplateDefault.unfollow"),
            icon: <UserCheck className="w-4 h-4" />,
            variant: "outline",
            onClick: () => unfollowUserMutation.mutate(),
            requiresConfirmation: false,
            isPending: unfollowUserMutation.isPending,
            show: true,
          });
        } else {
          actions.push({
            id: "follow",
            type: "follow",
            label: t("ProfileTemplateDefault.follow"),
            icon: <UserPlus className="w-4 h-4" />,
            variant: "outline",
            onClick: () => followUserMutation.mutate(),
            requiresConfirmation: false,
            isPending: followUserMutation.isPending,
            show: true,
          });
        }
      }

      // Action Friend Request/Remove Friend
      if (permissions.isFriend) {
        // Déjà ami → Bouton "Retirer des amis"
        actions.push({
          id: "unfriend",
          type: "unfriend",
          label: t("ProfileTemplateDefault.removeFriend"),
          icon: <UserX className="w-4 h-4" />,
          variant: "outline",
          onClick: () => removeFriendMutation.mutate({ user: entity as User }),
          requiresConfirmation: false,
          isPending: removeFriendMutation.isPending,
          show: true,
        });
      } else if (permissions.hasReceivedFriendRequest) {
        // Demande reçue → Accepter / Refuser
        actions.push({
          id: "acceptFriend",
          type: "accept",
          label: t("ProfileTemplateDefault.acceptFriendRequest"),
          icon: <Check className="w-4 h-4" />,
          variant: "default",
          onClick: () => acceptFriendMutation.mutate({ user: entity as User }),
          requiresConfirmation: false,
          isPending: acceptFriendMutation.isPending,
          show: true,
        });
        actions.push({
          id: "rejectFriend",
          type: "reject",
          label: t("ProfileTemplateDefault.rejectFriendRequest"),
          icon: <X className="w-4 h-4" />,
          variant: "outline",
          onClick: () => rejectFriendMutation.mutate({ user: entity as User }),
          requiresConfirmation: true,
          confirmationTitle: t("ProfileTemplateDefault.rejectFriendDialog.title"),
          confirmationDescription: t("ProfileTemplateDefault.rejectFriendDialog.description"),
          confirmationConfirm: t("ProfileTemplateDefault.rejectFriendDialog.confirm"),
          confirmationCancel: t("ProfileTemplateDefault.rejectFriendDialog.cancel"),
          isPending: rejectFriendMutation.isPending,
          show: true,
        });
      } else if (permissions.hasSentFriendRequest) {
        // Demande envoyée → Badge "Demande envoyée" + Annuler
        actions.push({
          id: "friendPending",
          type: "pending",
          label: t("ProfileTemplateDefault.friendRequestPending"),
          icon: <Clock className="w-4 h-4" />,
          variant: "outline",
          onClick: () => {},
          disabled: true,
          requiresConfirmation: false,
          show: true,
        });
        actions.push({
          id: "cancelFriend",
          type: "leave",
          label: t("ProfileTemplateDefault.cancelFriendRequest"),
          icon: <X className="w-4 h-4" />,
          variant: "outline",
          onClick: () => cancelFriendMutation.mutate({ user: entity as User }),
          requiresConfirmation: true,
          confirmationTitle: t("ProfileTemplateDefault.cancelFriendDialog.title"),
          confirmationDescription: t("ProfileTemplateDefault.cancelFriendDialog.description"),
          confirmationConfirm: t("ProfileTemplateDefault.cancelFriendDialog.confirm"),
          confirmationCancel: t("ProfileTemplateDefault.cancelFriendDialog.cancel"),
          isPending: cancelFriendMutation.isPending,
          show: true,
        });
      } else if (permissions.canSendFriendRequest) {
        // Peut envoyer une demande
        actions.push({
          id: "friend",
          type: "friend",
          label: t("ProfileTemplateDefault.sendFriendRequest"),
          icon: <UserPlus className="w-4 h-4" />,
          variant: "outline",
          onClick: () => sendFriendRequestMutation.mutate({ user: entity as User }),
          requiresConfirmation: false,
          isPending: sendFriendRequestMutation.isPending,
          show: true,
        });
      }

      if (actions.length === 0) return null;

      return {
        actions,
        layout: "separate-buttons",
      };
    }

    // ============ ORGANIZATIONS ============
    if (isOrganization(entity)) {
      const actions: EntityAction[] = [];

      // Déterminer le statut principal pour le bouton
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

      // Action Follow/Unfollow
      if (permissions.canFollow) {
        if (permissions.isFollowing) {
          actions.push({
            id: "unfollow",
            type: "unfollow",
            label: t("ProfileTemplateDefault.unfollow"),
            icon: <UserMinus className="w-4 h-4 mr-2" />,
            variant: "outline",
            onClick: () => unfollowOrgMutation.mutate(),
            requiresConfirmation: true,
            confirmationTitle: t("ProfileTemplateDefault.unfollowDialog.title"),
            confirmationDescription: t("ProfileTemplateDefault.unfollowDialog.description"),
            confirmationConfirm: t("ProfileTemplateDefault.unfollowDialog.confirm"),
            confirmationCancel: t("ProfileTemplateDefault.unfollowDialog.cancel"),
            isPending: unfollowOrgMutation.isPending,
            show: true,
          });
        } else {
          actions.push({
            id: "follow",
            type: "follow",
            label: t("ProfileTemplateDefault.follow"),
            icon: <UserPlus className="w-4 h-4 mr-2" />,
            variant: "outline",
            onClick: () => followOrgMutation.mutate(),
            requiresConfirmation: false,
            isPending: followOrgMutation.isPending,
            show: true,
          });
        }
      }

      // Action Request Membership
      if (permissions.canRequestMembership) {
        actions.push({
          id: "join",
          type: "join",
          label: t("ProfileTemplateDefault.requestMembership"),
          icon: <Users className="w-4 h-4 mr-2" />,
          variant: "default",
          onClick: () => requestMembershipMutation.mutate(),
          requiresConfirmation: true,
          confirmationTitle: t("ProfileTemplateDefault.membershipDialog.title"),
          confirmationDescription: t("ProfileTemplateDefault.membershipDialog.description"),
          confirmationConfirm: t("ProfileTemplateDefault.membershipDialog.confirm"),
          confirmationCancel: t("ProfileTemplateDefault.membershipDialog.cancel"),
          isPending: requestMembershipMutation.isPending,
          show: true,
        });
      }

      // Action Request Organization Admin (pour non-membres qui veulent devenir admin directement)
      if (permissions.canRequestOrganizationAdmin) {
        actions.push({
          id: "requestAdmin",
          type: "join",
          label: t("ProfileTemplateDefault.requestOrganizationAdmin"),
          icon: <UserCheck className="w-4 h-4 mr-2" />,
          variant: "default",
          onClick: () => requestOrgAdminMutation.mutate(),
          requiresConfirmation: true,
          confirmationTitle: t("ProfileTemplateDefault.orgAdminDialog.title"),
          confirmationDescription: t("ProfileTemplateDefault.orgAdminDialog.description"),
          confirmationConfirm: t("ProfileTemplateDefault.orgAdminDialog.confirm"),
          confirmationCancel: t("ProfileTemplateDefault.orgAdminDialog.cancel"),
          isPending: requestOrgAdminMutation.isPending,
          show: true,
        });
      }

      // En attente de validation par un admin - badge indicatif
      if (permissions.isToBeValidated) {
        actions.push({
          id: "pending",
          type: "pending",
          label: t("ProfileTemplateDefault.membershipPending"),
          icon: <Clock className="w-4 h-4 mr-2" />,
          variant: "outline",
          onClick: () => {},
          disabled: true,
          requiresConfirmation: false,
          show: true,
        });
      }

      // Invitation reçue - actions accepter/refuser
      if (permissions.isInviting) {
        actions.push({
          id: "acceptInvitation",
          type: "accept",
          label: t("ProfileTemplateDefault.acceptInvitation"),
          icon: <Check className="w-4 h-4 mr-2" />,
          variant: "default",
          onClick: () => acceptOrgInvitationMutation.mutate(),
          requiresConfirmation: false,
          isPending: acceptOrgInvitationMutation.isPending,
          show: true,
        });
        actions.push({
          id: "rejectInvitation",
          type: "reject",
          label: t("ProfileTemplateDefault.rejectInvitation"),
          icon: <X className="w-4 h-4 mr-2" />,
          variant: "outline",
          onClick: () => rejectOrgInvitationMutation.mutate(),
          requiresConfirmation: true,
          confirmationTitle: t("ProfileTemplateDefault.rejectInvitationDialog.title"),
          confirmationDescription: t("ProfileTemplateDefault.rejectInvitationDialog.description"),
          confirmationConfirm: t("ProfileTemplateDefault.rejectInvitationDialog.confirm"),
          confirmationCancel: t("ProfileTemplateDefault.rejectInvitationDialog.cancel"),
          isPending: rejectOrgInvitationMutation.isPending,
          show: true,
        });
      }

      // Invitation admin reçue - actions accepter/refuser
      if (permissions.isInvitingAdmin) {
        actions.push({
          id: "acceptAdminInvitation",
          type: "accept",
          label: t("ProfileTemplateDefault.acceptAdminInvitation"),
          icon: <Check className="w-4 h-4 mr-2" />,
          variant: "default",
          onClick: () => acceptOrgInvitationMutation.mutate(),
          requiresConfirmation: false,
          isPending: acceptOrgInvitationMutation.isPending,
          show: true,
        });
        actions.push({
          id: "rejectAdminInvitation",
          type: "reject",
          label: t("ProfileTemplateDefault.rejectInvitation"),
          icon: <X className="w-4 h-4 mr-2" />,
          variant: "outline",
          onClick: () => rejectOrgInvitationMutation.mutate(),
          requiresConfirmation: true,
          confirmationTitle: t("ProfileTemplateDefault.rejectInvitationDialog.title"),
          confirmationDescription: t("ProfileTemplateDefault.rejectInvitationDialog.description"),
          confirmationConfirm: t("ProfileTemplateDefault.rejectInvitationDialog.confirm"),
          confirmationCancel: t("ProfileTemplateDefault.rejectInvitationDialog.cancel"),
          isPending: rejectOrgInvitationMutation.isPending,
          show: true,
        });
      }

      // Demande admin en attente - badge indicatif
      if (permissions.isAdminPending) {
        actions.push({
          id: "adminPending",
          type: "pending",
          label: t("ProfileTemplateDefault.adminRequestPending"),
          icon: <Clock className="w-4 h-4 mr-2" />,
          variant: "outline",
          onClick: () => {},
          disabled: true,
          requiresConfirmation: false,
          show: true,
        });
      }

      // Action Request Promotion (membre → admin)
      if (permissions.canRequestPromotion) {
        actions.push({
          id: "requestPromotion",
          type: "join",
          label: t("ProfileTemplateDefault.requestPromotion"),
          icon: <UserCheck className="w-4 h-4 mr-2" />,
          variant: "default",
          onClick: () => requestPromotionMutation.mutate(),
          requiresConfirmation: true,
          confirmationTitle: t("ProfileTemplateDefault.promotionDialog.title"),
          confirmationDescription: t("ProfileTemplateDefault.promotionDialog.description"),
          confirmationConfirm: t("ProfileTemplateDefault.promotionDialog.confirm"),
          confirmationCancel: t("ProfileTemplateDefault.promotionDialog.cancel"),
          isPending: requestPromotionMutation.isPending,
          show: true,
        });
      }

      // Action Leave Organization
      if (permissions.isMember || permissions.isAdmin) {
        actions.push({
          id: "leave",
          type: "leave",
          label: t("ProfileTemplateDefault.leaveOrganization"),
          icon: <LogOut className="w-4 h-4 mr-2" />,
          variant: "destructive",
          onClick: () => leaveOrgMutation.mutate(),
          requiresConfirmation: true,
          confirmationTitle: t("ProfileTemplateDefault.leaveDialog.title"),
          confirmationDescription: t("ProfileTemplateDefault.leaveDialog.description"),
          confirmationConfirm: t("ProfileTemplateDefault.leaveDialog.confirm"),
          confirmationCancel: t("ProfileTemplateDefault.leaveDialog.cancel"),
          isDestructive: true,
          isPending: leaveOrgMutation.isPending,
          show: true,
        });
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
    }

    // ============ PROJECTS ============
    if (isProject(entity)) {
      const actions: EntityAction[] = [];

      // Déterminer le statut principal pour le bouton
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

      // Action Follow/Unfollow
      if (permissions.canFollow) {
        if (permissions.isFollowing) {
          actions.push({
            id: "unfollow",
            type: "unfollow",
            label: t("ProfileTemplateDefault.unfollow"),
            icon: <UserMinus className="w-4 h-4 mr-2" />,
            variant: "outline",
            onClick: () => unfollowProjectMutation.mutate(),
            requiresConfirmation: true,
            confirmationTitle: t("ProfileTemplateDefault.unfollowDialog.title"),
            confirmationDescription: t("ProfileTemplateDefault.unfollowDialog.description"),
            confirmationConfirm: t("ProfileTemplateDefault.unfollowDialog.confirm"),
            confirmationCancel: t("ProfileTemplateDefault.unfollowDialog.cancel"),
            isPending: unfollowProjectMutation.isPending,
            show: true,
          });
        } else {
          actions.push({
            id: "follow",
            type: "follow",
            label: t("ProfileTemplateDefault.follow"),
            icon: <UserPlus className="w-4 h-4 mr-2" />,
            variant: "outline",
            onClick: () => followProjectMutation.mutate(),
            requiresConfirmation: false,
            isPending: followProjectMutation.isPending,
            show: true,
          });
        }
      }

      // Action Request Contributor
      if (permissions.canRequestContributor) {
        actions.push({
          id: "join",
          type: "join",
          label: t("ProfileTemplateDefault.requestContributor"),
          icon: <Users className="w-4 h-4 mr-2" />,
          variant: "default",
          onClick: () => requestContributorMutation.mutate(),
          requiresConfirmation: true,
          confirmationTitle: t("ProfileTemplateDefault.contributorDialog.title"),
          confirmationDescription: t("ProfileTemplateDefault.contributorDialog.description"),
          confirmationConfirm: t("ProfileTemplateDefault.contributorDialog.confirm"),
          confirmationCancel: t("ProfileTemplateDefault.contributorDialog.cancel"),
          isPending: requestContributorMutation.isPending,
          show: true,
        });
      }

      // Action Request Admin (pour non-membres qui veulent devenir admin directement)
      if (permissions.canRequestProjectAdmin) {
        actions.push({
          id: "requestAdmin",
          type: "join",
          label: t("ProfileTemplateDefault.requestProjectAdmin"),
          icon: <UserCheck className="w-4 h-4 mr-2" />,
          variant: "default",
          onClick: () => requestProjectAdminMutation.mutate(),
          requiresConfirmation: true,
          confirmationTitle: t("ProfileTemplateDefault.projectAdminDialog.title"),
          confirmationDescription: t("ProfileTemplateDefault.projectAdminDialog.description"),
          confirmationConfirm: t("ProfileTemplateDefault.projectAdminDialog.confirm"),
          confirmationCancel: t("ProfileTemplateDefault.projectAdminDialog.cancel"),
          isPending: requestProjectAdminMutation.isPending,
          show: true,
        });
      }

      // Action Request Promotion (contributeur → admin)
      if (permissions.canRequestPromotion) {
        actions.push({
          id: "requestPromotion",
          type: "join",
          label: t("ProfileTemplateDefault.requestPromotion"),
          icon: <UserCheck className="w-4 h-4 mr-2" />,
          variant: "default",
          onClick: () => requestPromotionMutation.mutate(),
          requiresConfirmation: true,
          confirmationTitle: t("ProfileTemplateDefault.promotionDialog.title"),
          confirmationDescription: t("ProfileTemplateDefault.promotionDialog.description"),
          confirmationConfirm: t("ProfileTemplateDefault.promotionDialog.confirm"),
          confirmationCancel: t("ProfileTemplateDefault.promotionDialog.cancel"),
          isPending: requestPromotionMutation.isPending,
          show: true,
        });
      }

      // En attente de validation par un admin - badge indicatif
      if (permissions.isToBeValidated) {
        actions.push({
          id: "pending",
          type: "pending",
          label: t("ProfileTemplateDefault.contributorPending"),
          icon: <Clock className="w-4 h-4 mr-2" />,
          variant: "outline",
          onClick: () => {},
          disabled: true,
          requiresConfirmation: false,
          show: true,
        });
      }

      // Invitation reçue - actions accepter/refuser
      if (permissions.isInviting) {
        actions.push({
          id: "acceptInvitation",
          type: "accept",
          label: t("ProfileTemplateDefault.acceptInvitation"),
          icon: <Check className="w-4 h-4 mr-2" />,
          variant: "default",
          onClick: () => acceptProjectInvitationMutation.mutate(),
          requiresConfirmation: false,
          isPending: acceptProjectInvitationMutation.isPending,
          show: true,
        });
        actions.push({
          id: "rejectInvitation",
          type: "reject",
          label: t("ProfileTemplateDefault.rejectInvitation"),
          icon: <X className="w-4 h-4 mr-2" />,
          variant: "outline",
          onClick: () => rejectProjectInvitationMutation.mutate(),
          requiresConfirmation: true,
          confirmationTitle: t("ProfileTemplateDefault.rejectInvitationDialog.title"),
          confirmationDescription: t("ProfileTemplateDefault.rejectInvitationDialog.description"),
          confirmationConfirm: t("ProfileTemplateDefault.rejectInvitationDialog.confirm"),
          confirmationCancel: t("ProfileTemplateDefault.rejectInvitationDialog.cancel"),
          isPending: rejectProjectInvitationMutation.isPending,
          show: true,
        });
      }

      // Invitation admin reçue - actions accepter/refuser
      if (permissions.isInvitingAdmin) {
        actions.push({
          id: "acceptAdminInvitation",
          type: "accept",
          label: t("ProfileTemplateDefault.acceptAdminInvitation"),
          icon: <Check className="w-4 h-4 mr-2" />,
          variant: "default",
          onClick: () => acceptProjectInvitationMutation.mutate(),
          requiresConfirmation: false,
          isPending: acceptProjectInvitationMutation.isPending,
          show: true,
        });
        actions.push({
          id: "rejectAdminInvitation",
          type: "reject",
          label: t("ProfileTemplateDefault.rejectInvitation"),
          icon: <X className="w-4 h-4 mr-2" />,
          variant: "outline",
          onClick: () => rejectProjectInvitationMutation.mutate(),
          requiresConfirmation: true,
          confirmationTitle: t("ProfileTemplateDefault.rejectInvitationDialog.title"),
          confirmationDescription: t("ProfileTemplateDefault.rejectInvitationDialog.description"),
          confirmationConfirm: t("ProfileTemplateDefault.rejectInvitationDialog.confirm"),
          confirmationCancel: t("ProfileTemplateDefault.rejectInvitationDialog.cancel"),
          isPending: rejectProjectInvitationMutation.isPending,
          show: true,
        });
      }

      // Demande admin en attente - badge indicatif
      if (permissions.isAdminPending) {
        actions.push({
          id: "adminPending",
          type: "pending",
          label: t("ProfileTemplateDefault.adminRequestPending"),
          icon: <Clock className="w-4 h-4 mr-2" />,
          variant: "outline",
          onClick: () => {},
          disabled: true,
          requiresConfirmation: false,
          show: true,
        });
      }

      // Action Leave Project
      if (permissions.isContributor || permissions.isAdmin) {
        actions.push({
          id: "leave",
          type: "leave",
          label: t("ProfileTemplateDefault.leaveProject"),
          icon: <LogOut className="w-4 h-4 mr-2" />,
          variant: "destructive",
          onClick: () => leaveProjectMutation.mutate(),
          requiresConfirmation: true,
          confirmationTitle: t("ProfileTemplateDefault.leaveProjectDialog.title"),
          confirmationDescription: t("ProfileTemplateDefault.leaveProjectDialog.description"),
          confirmationConfirm: t("ProfileTemplateDefault.leaveProjectDialog.confirm"),
          confirmationCancel: t("ProfileTemplateDefault.leaveProjectDialog.cancel"),
          isDestructive: true,
          isPending: leaveProjectMutation.isPending,
          show: true,
        });
      }

      return {
        actions,
        layout: "status-dropdown",
        statusLabel,
        statusIcon,
        statusVariant,
      };
    }

    // ============ EVENTS ============
    if (isEvent(entity)) {
      const actions: EntityAction[] = [];

      // Déterminer le statut principal pour le bouton
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

      // Action Follow/Unfollow
      if (permissions.canFollow) {
        if (permissions.isFollowing) {
          actions.push({
            id: "unfollow",
            type: "unfollow",
            label: t("ProfileTemplateDefault.unfollow"),
            icon: <UserMinus className="w-4 h-4 mr-2" />,
            variant: "outline",
            onClick: () => unfollowEventMutation.mutate(),
            requiresConfirmation: true,
            confirmationTitle: t("ProfileTemplateDefault.unfollowDialog.title"),
            confirmationDescription: t("ProfileTemplateDefault.unfollowDialog.description"),
            confirmationConfirm: t("ProfileTemplateDefault.unfollowDialog.confirm"),
            confirmationCancel: t("ProfileTemplateDefault.unfollowDialog.cancel"),
            isPending: unfollowEventMutation.isPending,
            show: true,
          });
        } else {
          actions.push({
            id: "follow",
            type: "follow",
            label: t("ProfileTemplateDefault.follow"),
            icon: <UserPlus className="w-4 h-4 mr-2" />,
            variant: "outline",
            onClick: () => followEventMutation.mutate(),
            requiresConfirmation: false,
            isPending: followEventMutation.isPending,
            show: true,
          });
        }
      }

      // Action Participate
      if (permissions.canParticipate) {
        actions.push({
          id: "participate",
          type: "join",
          label: t("ProfileTemplateDefault.participate"),
          icon: <Users className="w-4 h-4 mr-2" />,
          variant: "default",
          onClick: () => participateEventMutation.mutate(),
          requiresConfirmation: true,
          confirmationTitle: t("ProfileTemplateDefault.participateDialog.title"),
          confirmationDescription: t("ProfileTemplateDefault.participateDialog.description"),
          confirmationConfirm: t("ProfileTemplateDefault.participateDialog.confirm"),
          confirmationCancel: t("ProfileTemplateDefault.participateDialog.cancel"),
          isPending: participateEventMutation.isPending,
          show: true,
        });
      }

      // En attente de validation par un admin - badge indicatif
      if (permissions.isToBeValidated) {
        actions.push({
          id: "pending",
          type: "pending",
          label: t("ProfileTemplateDefault.participationPending"),
          icon: <Clock className="w-4 h-4 mr-2" />,
          variant: "outline",
          onClick: () => {},
          disabled: true,
          requiresConfirmation: false,
          show: true,
        });
      }

      // Invitation reçue - actions accepter/refuser
      if (permissions.isInviting) {
        actions.push({
          id: "acceptInvitation",
          type: "accept",
          label: t("ProfileTemplateDefault.acceptInvitation"),
          icon: <Check className="w-4 h-4 mr-2" />,
          variant: "default",
          onClick: () => acceptEventInvitationMutation.mutate(),
          requiresConfirmation: false,
          isPending: acceptEventInvitationMutation.isPending,
          show: true,
        });
        actions.push({
          id: "rejectInvitation",
          type: "reject",
          label: t("ProfileTemplateDefault.rejectInvitation"),
          icon: <X className="w-4 h-4 mr-2" />,
          variant: "outline",
          onClick: () => rejectEventInvitationMutation.mutate(),
          requiresConfirmation: true,
          confirmationTitle: t("ProfileTemplateDefault.rejectInvitationDialog.title"),
          confirmationDescription: t("ProfileTemplateDefault.rejectInvitationDialog.description"),
          confirmationConfirm: t("ProfileTemplateDefault.rejectInvitationDialog.confirm"),
          confirmationCancel: t("ProfileTemplateDefault.rejectInvitationDialog.cancel"),
          isPending: rejectEventInvitationMutation.isPending,
          show: true,
        });
      }

      // Action Leave Event
      if (permissions.isParticipant) {
        actions.push({
          id: "leave",
          type: "leave",
          label: t("ProfileTemplateDefault.leaveEvent"),
          icon: <LogOut className="w-4 h-4 mr-2" />,
          variant: "destructive",
          onClick: () => leaveEventMutation.mutate(),
          requiresConfirmation: true,
          confirmationTitle: t("ProfileTemplateDefault.leaveEventDialog.title"),
          confirmationDescription: t("ProfileTemplateDefault.leaveEventDialog.description"),
          confirmationConfirm: t("ProfileTemplateDefault.leaveEventDialog.confirm"),
          confirmationCancel: t("ProfileTemplateDefault.leaveEventDialog.cancel"),
          isDestructive: true,
          isPending: leaveEventMutation.isPending,
          show: true,
        });
      }

      return {
        actions,
        layout: "status-dropdown",
        statusLabel,
        statusIcon,
        statusVariant,
      };
    }

    return null;
  }, [
    entity,
    me,
    permissions,
    t,
    followUserMutation,
    unfollowUserMutation,
    sendFriendRequestMutation,
    removeFriendMutation,
    acceptFriendMutation,
    rejectFriendMutation,
    cancelFriendMutation,
    followOrgMutation,
    unfollowOrgMutation,
    requestMembershipMutation,
    requestOrgAdminMutation,
    leaveOrgMutation,
    acceptOrgInvitationMutation,
    rejectOrgInvitationMutation,
    followProjectMutation,
    unfollowProjectMutation,
    requestContributorMutation,
    requestProjectAdminMutation,
    requestPromotionMutation,
    leaveProjectMutation,
    acceptProjectInvitationMutation,
    rejectProjectInvitationMutation,
    followEventMutation,
    unfollowEventMutation,
    participateEventMutation,
    leaveEventMutation,
    acceptEventInvitationMutation,
    rejectEventInvitationMutation,
  ]);
}
