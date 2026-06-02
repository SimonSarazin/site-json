import { useState } from "react";
import {
  Mail,
  Phone,
  Globe,
  Share2,
  Flag,
  UserPlus,
  UserMinus,
  Bell,
  BellOff,
  MoreHorizontal,
  Calendar,
  MessageCircle,
  ExternalLink,
  Copy,
  Check,
  Loader2,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useT } from "@/hooks/useT";
import { useCocolight } from "@/hooks/useCocolight";
import { isUser } from "@/lib/getTypedEntity";
import { useProfileEntity } from "../../hooks/useProfileEntity";
import { useProfilPermissions } from "../../hooks/useProfilPermissions";
import {
  useFollowEntity,
  useUnfollowEntity,
  useRequestToJoin,
  useLeaveEntity,
} from "../../actions/mutations/relationship";
import {
  useSendFriendRequest,
  useRemoveFriend,
  useAcceptFriendRequest,
  useCancelFriendRequest,
} from "../../actions/mutations/friend";
import { toast } from "sonner";

interface ProfileActionsProps {
  email?: string;
  phone?: string;
  url?: string;
  onContact?: () => void;
}

export function ProfileActions({ email, phone, url }: ProfileActionsProps) {
  const t = useT("modules/profil");
  const { me } = useCocolight();
  const { entity, entityType } = useProfileEntity();
  const permissions = useProfilPermissions(entity);
  const [copied, setCopied] = useState(false);

  const currentUser = me && isUser(me) ? me : null;

  const followMutation = useFollowEntity(entity);
  const unfollowMutation = useUnfollowEntity(entity);
  const requestToJoinMutation = useRequestToJoin(entity);
  const leaveMutation = useLeaveEntity(entity);
  const sendFriendRequestMutation = useSendFriendRequest(currentUser);
  const removeFriendMutation = useRemoveFriend(currentUser);
  const acceptFriendMutation = useAcceptFriendRequest(currentUser);
  const cancelFriendMutation = useCancelFriendRequest(currentUser);

  const isOwnProfile = me?.id === entity?.id;
  const isConnected = me?.isConnected;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      toast.success(t("ProfileActions.linkCopied"));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t("ProfileActions.copyError"));
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: entity?.serverData?.name as string,
          url: window.location.href,
        });
      } catch {
        // User cancelled
      }
    } else {
      handleCopyLink();
    }
  };

  const handleEmail = () => {
    if (email) {
      window.location.href = `mailto:${email}`;
    }
  };

  const handlePhone = () => {
    if (phone) {
      window.location.href = `tel:${phone}`;
    }
  };

  const handleWebsite = () => {
    if (url) {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  const handleAddFriend = () => {
    if (isUser(entity)) {
      sendFriendRequestMutation.mutate({ user: entity });
    }
  };

  const handleRemoveFriend = () => {
    if (isUser(entity)) {
      removeFriendMutation.mutate({ user: entity });
    }
  };

  const handleAcceptFriend = () => {
    if (isUser(entity)) {
      acceptFriendMutation.mutate({ user: entity });
    }
  };

  const handleCancelFriendRequest = () => {
    if (isUser(entity)) {
      cancelFriendMutation.mutate({ user: entity });
    }
  };

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
    leaveMutation.mutate();
  };

  const handleReport = () => {
    toast.info(t("ProfileActions.featureComingSoon"));
  };

  const handleMessage = () => {
    toast.info(t("ProfileActions.featureComingSoon"));
  };

  const showRelationActions = !isOwnProfile && isConnected;

  const isLoading =
    followMutation.isPending ||
    unfollowMutation.isPending ||
    requestToJoinMutation.isPending ||
    leaveMutation.isPending ||
    sendFriendRequestMutation.isPending ||
    removeFriendMutation.isPending ||
    acceptFriendMutation.isPending ||
    cancelFriendMutation.isPending;

  const getPrimaryAction = () => {
    if (isOwnProfile || !isConnected) return null;

    if (entityType === "citoyens") {
      if (permissions.hasReceivedFriendRequest) {
        return (
          <Button
            size="sm"
            onClick={handleAcceptFriend}
            className="gap-2 bg-primary hover:bg-primary/90"
            disabled={acceptFriendMutation.isPending}
          >
            {acceptFriendMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            <span className="hidden sm:inline">{t("ProfileActions.acceptFriend")}</span>
          </Button>
        );
      }

      if (permissions.hasSentFriendRequest) {
        return (
          <Button
            variant="outline"
            size="sm"
            onClick={handleCancelFriendRequest}
            className="gap-2"
            disabled={cancelFriendMutation.isPending}
          >
            {cancelFriendMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Clock className="w-4 h-4" />
            )}
            <span className="hidden sm:inline">{t("ProfileActions.friendRequestPending")}</span>
          </Button>
        );
      }

      if (permissions.isFriend) {
        return (
          <Button
            variant="outline"
            size="sm"
            onClick={handleMessage}
            className="gap-2"
          >
            <MessageCircle className="w-4 h-4" />
            <span className="hidden sm:inline">{t("ProfileActions.message")}</span>
          </Button>
        );
      }

      if (permissions.canSendFriendRequest) {
        return (
          <Button
            size="sm"
            onClick={handleAddFriend}
            className="gap-2 bg-primary hover:bg-primary/90"
            disabled={sendFriendRequestMutation.isPending}
          >
            {sendFriendRequestMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <UserPlus className="w-4 h-4" />
            )}
            <span className="hidden sm:inline">{t("ProfileActions.addFriend")}</span>
          </Button>
        );
      }
    }

    if (entityType === "organizations") {
      if (permissions.isMember || permissions.isAdmin) {
        return (
          <Button
            variant="outline"
            size="sm"
            onClick={handleMessage}
            className="gap-2"
          >
            <MessageCircle className="w-4 h-4" />
            <span className="hidden sm:inline">{t("ProfileActions.contact")}</span>
          </Button>
        );
      }
      if (permissions.canRequestMembership) {
        return (
          <Button
            size="sm"
            onClick={handleJoin}
            className="gap-2 bg-primary hover:bg-primary/90"
            disabled={requestToJoinMutation.isPending}
          >
            {requestToJoinMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <UserPlus className="w-4 h-4" />
            )}
            <span className="hidden sm:inline">{t("ProfileActions.join")}</span>
          </Button>
        );
      }
    }

    if (entityType === "projects") {
      if (permissions.isContributor || permissions.isAdmin) {
        return (
          <Button
            variant="outline"
            size="sm"
            onClick={handleMessage}
            className="gap-2"
          >
            <MessageCircle className="w-4 h-4" />
            <span className="hidden sm:inline">{t("ProfileActions.contact")}</span>
          </Button>
        );
      }
      if (permissions.canRequestContributor) {
        return (
          <Button
            size="sm"
            onClick={handleJoin}
            className="gap-2 bg-primary hover:bg-primary/90"
            disabled={requestToJoinMutation.isPending}
          >
            {requestToJoinMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <UserPlus className="w-4 h-4" />
            )}
            <span className="hidden sm:inline">{t("ProfileActions.contribute")}</span>
          </Button>
        );
      }
    }

    if (entityType === "events") {
      if (permissions.canParticipate) {
        return (
          <Button
            size="sm"
            onClick={handleJoin}
            className="gap-2 bg-primary hover:bg-primary/90"
            disabled={requestToJoinMutation.isPending}
          >
            {requestToJoinMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Calendar className="w-4 h-4" />
            )}
            <span className="hidden sm:inline">{t("ProfileActions.participate")}</span>
          </Button>
        );
      }
    }

    return null;
  };

  return (
    <div className="flex items-center gap-2">
      {showRelationActions && getPrimaryAction()}

      {(email || phone || url) && (
        <div className="hidden sm:flex items-center gap-1">
          {email && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleEmail}
              className="h-9 w-9"
              title={email}
              aria-label={String(t("a11y.contactEmail"))}
            >
              <Mail className="w-4 h-4" />
            </Button>
          )}
          {phone && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handlePhone}
              className="h-9 w-9"
              title={phone}
              aria-label={String(t("a11y.callPhone"))}
            >
              <Phone className="w-4 h-4" />
            </Button>
          )}
          {url && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleWebsite}
              className="h-9 w-9"
              title={url}
              aria-label={String(t("a11y.visitWebsite"))}
            >
              <Globe className="w-4 h-4" />
            </Button>
          )}
        </div>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" className="h-9 w-9" disabled={isLoading} aria-label={String(t("a11y.moreOptions"))}>
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <MoreHorizontal className="w-4 h-4" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <div className="sm:hidden">
            {email && (
              <DropdownMenuItem onClick={handleEmail}>
                <Mail className="w-4 h-4 mr-2" />
                {t("ProfileActions.sendEmail")}
              </DropdownMenuItem>
            )}
            {phone && (
              <DropdownMenuItem onClick={handlePhone}>
                <Phone className="w-4 h-4 mr-2" />
                {t("ProfileActions.call")}
              </DropdownMenuItem>
            )}
            {url && (
              <DropdownMenuItem onClick={handleWebsite}>
                <ExternalLink className="w-4 h-4 mr-2" />
                {t("ProfileActions.visitWebsite")}
              </DropdownMenuItem>
            )}
            {(email || phone || url) && <DropdownMenuSeparator />}
          </div>

          {showRelationActions && (
            <>
              {entityType === "citoyens" && (
                <>
                  {permissions.isFriend ? (
                    <DropdownMenuItem
                      onClick={handleRemoveFriend}
                      className="text-destructive"
                      disabled={removeFriendMutation.isPending}
                    >
                      {removeFriendMutation.isPending ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <UserMinus className="w-4 h-4 mr-2" />
                      )}
                      {t("ProfileActions.removeFriend")}
                    </DropdownMenuItem>
                  ) : permissions.canSendFriendRequest ? (
                    <DropdownMenuItem
                      onClick={handleAddFriend}
                      disabled={sendFriendRequestMutation.isPending}
                    >
                      {sendFriendRequestMutation.isPending ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <UserPlus className="w-4 h-4 mr-2" />
                      )}
                      {t("ProfileActions.addFriend")}
                    </DropdownMenuItem>
                  ) : null}

                  {permissions.canFollow && (
                    permissions.isFollowing ? (
                      <DropdownMenuItem
                        onClick={handleUnfollow}
                        disabled={unfollowMutation.isPending}
                      >
                        {unfollowMutation.isPending ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <BellOff className="w-4 h-4 mr-2" />
                        )}
                        {t("ProfileActions.unfollow")}
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem
                        onClick={handleFollow}
                        disabled={followMutation.isPending}
                      >
                        {followMutation.isPending ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Bell className="w-4 h-4 mr-2" />
                        )}
                        {t("ProfileActions.follow")}
                      </DropdownMenuItem>
                    )
                  )}
                </>
              )}

              {(entityType === "organizations" || entityType === "projects") && (
                <>
                  {(permissions.isMember || permissions.isContributor || permissions.isAdmin) ? (
                    <DropdownMenuItem
                      onClick={handleLeave}
                      className="text-destructive"
                      disabled={leaveMutation.isPending}
                    >
                      {leaveMutation.isPending ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <UserMinus className="w-4 h-4 mr-2" />
                      )}
                      {entityType === "organizations"
                        ? t("ProfileActions.leaveOrganization")
                        : t("ProfileActions.leaveProject")}
                    </DropdownMenuItem>
                  ) : (permissions.canRequestMembership || permissions.canRequestContributor) ? (
                    <DropdownMenuItem
                      onClick={handleJoin}
                      disabled={requestToJoinMutation.isPending}
                    >
                      {requestToJoinMutation.isPending ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <UserPlus className="w-4 h-4 mr-2" />
                      )}
                      {entityType === "organizations"
                        ? t("ProfileActions.joinOrganization")
                        : t("ProfileActions.contributeProject")}
                    </DropdownMenuItem>
                  ) : null}

                  {permissions.canFollow && (
                    permissions.isFollowing ? (
                      <DropdownMenuItem
                        onClick={handleUnfollow}
                        disabled={unfollowMutation.isPending}
                      >
                        {unfollowMutation.isPending ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <BellOff className="w-4 h-4 mr-2" />
                        )}
                        {t("ProfileActions.unfollow")}
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem
                        onClick={handleFollow}
                        disabled={followMutation.isPending}
                      >
                        {followMutation.isPending ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Bell className="w-4 h-4 mr-2" />
                        )}
                        {t("ProfileActions.follow")}
                      </DropdownMenuItem>
                    )
                  )}
                </>
              )}
              <DropdownMenuSeparator />
            </>
          )}

          <DropdownMenuItem onClick={handleShare}>
            <Share2 className="w-4 h-4 mr-2" />
            {t("ProfileActions.share")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleCopyLink}>
            {copied ? (
              <Check className="w-4 h-4 mr-2 text-green-500" />
            ) : (
              <Copy className="w-4 h-4 mr-2" />
            )}
            {t("ProfileActions.copyLink")}
          </DropdownMenuItem>

          {!isOwnProfile && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleReport} className="text-destructive">
                <Flag className="w-4 h-4 mr-2" />
                {t("ProfileActions.report")}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
