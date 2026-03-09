import { useState } from "react";
import {
  Crown,
  UserCheck,
  UserPlus,
  ChevronDown,
  LogOut,
  Bell,
  BellOff,
  Check,
  X,
  Clock,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useT } from "@/hooks/useT";
import { useCocolight } from "@/hooks/useCocolight";
import { useProfileEntity } from "../../hooks/useProfileEntity";
import { useProfilPermissions } from "../../hooks/useProfilPermissions";
import {
  useFollowEntity,
  useUnfollowEntity,
  useRequestToJoin,
  useLeaveEntity,
  useAcceptInvitation,
  useRejectInvitation,
} from "../../hooks/useRelationshipMutations";

export function EntityStatusButton() {
  const t = useT("modules/profil");
  const { me } = useCocolight();
  const { entity, entityType } = useProfileEntity();
  const permissions = useProfilPermissions(entity);
  const [confirmAction, setConfirmAction] = useState<string | null>(null);

  const followMutation = useFollowEntity();
  const unfollowMutation = useUnfollowEntity();
  const requestToJoinMutation = useRequestToJoin();
  const leaveMutation = useLeaveEntity();
  const acceptInvitationMutation = useAcceptInvitation();
  const rejectInvitationMutation = useRejectInvitation();

  const isOwnProfile = me?.id === entity?.id;
  const isConnected = me?.isConnected;

  if (isOwnProfile || !isConnected || !entity) {
    return null;
  }

  if (entityType === "citoyens") {
    return null;
  }

  const getStatusConfig = () => {
    if (permissions.isAdmin) {
      return {
        label: t("EntityStatusButton.admin"),
        icon: <Crown className="w-4 h-4" />,
        variant: "default" as const,
      };
    }
    if (permissions.isMember) {
      return {
        label: t("EntityStatusButton.member"),
        icon: <UserCheck className="w-4 h-4" />,
        variant: "default" as const,
      };
    }
    if (permissions.isContributor) {
      return {
        label: t("EntityStatusButton.contributor"),
        icon: <UserCheck className="w-4 h-4" />,
        variant: "default" as const,
      };
    }
    if (permissions.isFollowing) {
      return {
        label: t("EntityStatusButton.following"),
        icon: <Bell className="w-4 h-4" />,
        variant: "outline" as const,
      };
    }
    return {
      label: t("EntityStatusButton.follow"),
      icon: <UserPlus className="w-4 h-4" />,
      variant: "outline" as const,
    };
  };

  const statusConfig = getStatusConfig();

  const handleFollow = () => {
    followMutation.mutate();
  };

  const handleUnfollow = () => {
    unfollowMutation.mutate();
  };

  const handleJoin = () => {
    requestToJoinMutation.mutate();
  };

  const handleLeave = () => {
    setConfirmAction("leave");
  };

  const handleAcceptInvitation = () => {
    acceptInvitationMutation.mutate();
  };

  const handleRejectInvitation = () => {
    rejectInvitationMutation.mutate();
  };

  const handleConfirmLeave = () => {
    leaveMutation.mutate();
    setConfirmAction(null);
  };

  const isLoading =
    followMutation.isPending ||
    unfollowMutation.isPending ||
    requestToJoinMutation.isPending ||
    leaveMutation.isPending ||
    acceptInvitationMutation.isPending ||
    rejectInvitationMutation.isPending;

  const hasRole = permissions.isAdmin || permissions.isMember || permissions.isContributor;
  const hasPendingState =
    permissions.isInviting ||
    permissions.isInvitingAdmin ||
    permissions.isToBeValidated ||
    permissions.isAdminPending;

  const canJoin =
    entityType === "organizations"
      ? permissions.canRequestMembership
      : permissions.canRequestContributor;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant={statusConfig.variant} size="sm" className="gap-2" disabled={isLoading}>
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              statusConfig.icon
            )}
            <span className="hidden sm:inline">{statusConfig.label}</span>
            <ChevronDown className="w-3 h-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {permissions.canFollow && (
            permissions.isFollowing ? (
              <DropdownMenuItem onClick={handleUnfollow} disabled={unfollowMutation.isPending}>
                {unfollowMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <BellOff className="w-4 h-4 mr-2" />
                )}
                {t("EntityStatusButton.unfollow")}
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={handleFollow} disabled={followMutation.isPending}>
                {followMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Bell className="w-4 h-4 mr-2" />
                )}
                {t("EntityStatusButton.follow")}
              </DropdownMenuItem>
            )
          )}

          {hasPendingState && (
            <>
              <DropdownMenuSeparator />
              {permissions.isInviting && (
                <>
                  <DropdownMenuItem
                    onClick={handleAcceptInvitation}
                    disabled={acceptInvitationMutation.isPending}
                  >
                    {acceptInvitationMutation.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4 mr-2 text-green-500" />
                    )}
                    {t("EntityStatusButton.acceptInvitation")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={handleRejectInvitation}
                    disabled={rejectInvitationMutation.isPending}
                    className="text-destructive"
                  >
                    {rejectInvitationMutation.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <X className="w-4 h-4 mr-2" />
                    )}
                    {t("EntityStatusButton.rejectInvitation")}
                  </DropdownMenuItem>
                </>
              )}
              {permissions.isInvitingAdmin && (
                <>
                  <DropdownMenuItem
                    onClick={handleAcceptInvitation}
                    disabled={acceptInvitationMutation.isPending}
                  >
                    {acceptInvitationMutation.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Crown className="w-4 h-4 mr-2 text-green-500" />
                    )}
                    {t("EntityStatusButton.acceptAdminInvitation")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={handleRejectInvitation}
                    disabled={rejectInvitationMutation.isPending}
                    className="text-destructive"
                  >
                    {rejectInvitationMutation.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <X className="w-4 h-4 mr-2" />
                    )}
                    {t("EntityStatusButton.rejectInvitation")}
                  </DropdownMenuItem>
                </>
              )}
              {permissions.isToBeValidated && (
                <DropdownMenuItem disabled className="opacity-70">
                  <Clock className="w-4 h-4 mr-2" />
                  {t("EntityStatusButton.membershipPending")}
                </DropdownMenuItem>
              )}
              {permissions.isAdminPending && (
                <DropdownMenuItem disabled className="opacity-70">
                  <Clock className="w-4 h-4 mr-2" />
                  {t("EntityStatusButton.adminRequestPending")}
                </DropdownMenuItem>
              )}
            </>
          )}

          {canJoin && !hasPendingState && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleJoin} disabled={requestToJoinMutation.isPending}>
                {requestToJoinMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <UserPlus className="w-4 h-4 mr-2" />
                )}
                {entityType === "organizations"
                  ? t("EntityStatusButton.joinOrganization")
                  : t("EntityStatusButton.contributeProject")}
              </DropdownMenuItem>
            </>
          )}

          {hasRole && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLeave} className="text-destructive">
                <LogOut className="w-4 h-4 mr-2" />
                {entityType === "organizations"
                  ? t("EntityStatusButton.leaveOrganization")
                  : t("EntityStatusButton.leaveProject")}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmAction === "leave"} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {entityType === "organizations"
                ? t("EntityStatusButton.confirmLeaveOrgTitle")
                : t("EntityStatusButton.confirmLeaveProjectTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {entityType === "organizations"
                ? t("EntityStatusButton.confirmLeaveOrgDescription")
                : t("EntityStatusButton.confirmLeaveProjectDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("EntityStatusButton.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmLeave}
              className="bg-destructive hover:bg-destructive/90"
              disabled={leaveMutation.isPending}
            >
              {leaveMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : null}
              {t("EntityStatusButton.confirmLeave")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
