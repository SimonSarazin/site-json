import { useMemo } from "react";
import type { EntityTypes } from "@communecter/cocolight-api-client";
import { isUser, isOrganization, isProject, isEvent } from "@/lib/getTypedEntity";
import { useT } from "@/hooks/useT";
import { useUserPermissions } from "./useUserPermissions";
import {
  useFollowUser,
  useUnfollowUser,
  useSendFriendRequest,
  useRemoveFriend,
  useFollowOrganization,
  useUnfollowOrganization,
  useRequestMembership,
  useLeaveOrganization,
  useFollowProject,
  useUnfollowProject,
  useRequestContributor,
  useRequestProjectAdmin,
  useLeaveProject,
  useFollowEvent,
  useUnfollowEvent,
  useParticipateEvent,
  useLeaveEvent,
} from "./useRelationshipMutations";
import { UserPlus, UserMinus, UserCheck, UserX, Users, LogOut } from "lucide-react";

export interface EntityAction {
  id: string;
  type: "follow" | "unfollow" | "friend" | "unfriend" | "join" | "leave";
  label: string;
  icon: React.ReactNode;
  variant: "default" | "outline" | "destructive";
  onClick: () => void;
  requiresConfirmation: boolean;
  confirmationTitle?: string;
  confirmationDescription?: string;
  confirmationConfirm?: string;
  confirmationCancel?: string;
  isDestructive?: boolean;
  isPending: boolean;
  show: boolean;
}

export interface EntityActionsResult {
  actions: EntityAction[];
  layout: "separate-buttons" | "status-dropdown";
  statusLabel?: string;
  statusIcon?: React.ReactNode;
  statusVariant?: "default" | "outline";
}

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

  // Mutations pour Users
  const followUserMutation = useFollowUser(entity);
  const unfollowUserMutation = useUnfollowUser(entity);
  const sendFriendRequestMutation = useSendFriendRequest(entity);
  const removeFriendMutation = useRemoveFriend(entity);

  // Mutations pour Organizations
  const followOrgMutation = useFollowOrganization(entity);
  const unfollowOrgMutation = useUnfollowOrganization(entity);
  const requestMembershipMutation = useRequestMembership(entity);
  const leaveOrgMutation = useLeaveOrganization(entity);

  // Mutations pour Projects
  const followProjectMutation = useFollowProject(entity);
  const unfollowProjectMutation = useUnfollowProject(entity);
  const requestContributorMutation = useRequestContributor(entity);
  const requestProjectAdminMutation = useRequestProjectAdmin(entity);
  const leaveProjectMutation = useLeaveProject(entity);

  // Mutations pour Events
  const followEventMutation = useFollowEvent(entity);
  const unfollowEventMutation = useUnfollowEvent(entity);
  const participateEventMutation = useParticipateEvent(entity);
  const leaveEventMutation = useLeaveEvent(entity);

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
      if (permissions.canSendFriendRequest) {
        if (permissions.isFriend) {
          actions.push({
            id: "unfriend",
            type: "unfriend",
            label: t("ProfileTemplateDefault.removeFriend"),
            icon: <UserX className="w-4 h-4" />,
            variant: "outline",
            onClick: () => removeFriendMutation.mutate(),
            requiresConfirmation: false,
            isPending: removeFriendMutation.isPending,
            show: true,
          });
        } else {
          actions.push({
            id: "friend",
            type: "friend",
            label: t("ProfileTemplateDefault.sendFriendRequest"),
            icon: <UserPlus className="w-4 h-4" />,
            variant: "outline",
            onClick: () => sendFriendRequestMutation.mutate(),
            requiresConfirmation: false,
            isPending: sendFriendRequestMutation.isPending,
            show: true,
          });
        }
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

      // Action Request Admin
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
    permissions,
    t,
    followUserMutation,
    unfollowUserMutation,
    sendFriendRequestMutation,
    removeFriendMutation,
    followOrgMutation,
    unfollowOrgMutation,
    requestMembershipMutation,
    leaveOrgMutation,
    followProjectMutation,
    unfollowProjectMutation,
    requestContributorMutation,
    requestProjectAdminMutation,
    leaveProjectMutation,
    followEventMutation,
    unfollowEventMutation,
    participateEventMutation,
    leaveEventMutation,
  ]);
}
