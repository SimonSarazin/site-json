import { Users, UserPlus, Check, X, UserMinus, Search, Loader2 } from "lucide-react";
import { useState } from "react";
import { useProfileEntity } from "../../hooks/useProfileEntity";
import { useProfilFriendsQuery } from "../../hooks/useProfilFriendsQuery";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import "@/modules/profil/i18n";
import { FriendItem } from "./FriendItem";
import { FriendItemDetailed } from "./FriendItemDetailed";
import { EntityGridView } from "../shared/EntityGridView";
import { useCocolight } from "@/hooks/useCocolight";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useSearchUsers, type SearchedUser } from "../../hooks/useSearchUsers";
import type { User } from "@communecter/cocolight-api-client";

interface FriendsTabProps {
  enabled?: boolean;
}

type TabStatus = "confirmed" | "pending" | "sent";

export function FriendsTab({ enabled = true }: FriendsTabProps) {
  const { entity, entityType } = useProfileEntity();
  useLoadNamespace("modules/profil");
  const t = useT("modules/profil");
  const { me } = useCocolight();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<TabStatus>("confirmed");
  const [addFriendOpen, setAddFriendOpen] = useState(false);
  const [addFriendSearch, setAddFriendSearch] = useState("");

  const isOwnProfile = me?.id === entity?.id;

  const confirmedQuery = useProfilFriendsQuery({
    entity,
    entityType,
    enabled: enabled && isOwnProfile,
    indexStep: 12,
    searchQuery: activeTab === "confirmed" ? searchQuery : "",
    status: "confirmed",
  });

  const pendingQuery = useProfilFriendsQuery({
    entity,
    entityType,
    enabled: enabled && isOwnProfile,
    indexStep: 12,
    searchQuery: "",
    status: "pending",
  });

  const sentQuery = useProfilFriendsQuery({
    entity,
    entityType,
    enabled: enabled && isOwnProfile,
    indexStep: 12,
    searchQuery: "",
    status: "sent",
  });

  // Query for other profiles (all friends)
  const allFriendsQuery = useProfilFriendsQuery({
    entity,
    entityType,
    enabled: enabled && !isOwnProfile,
    indexStep: 12,
    searchQuery,
    status: "all",
  });

  const getCurrentQuery = () => {
    if (!isOwnProfile) return allFriendsQuery;
    switch (activeTab) {
      case "confirmed":
        return confirmedQuery;
      case "pending":
        return pendingQuery;
      case "sent":
        return sentQuery;
      default:
        return confirmedQuery;
    }
  };

  const currentQuery = getCurrentQuery();
  const { friends, isLoading, isFetchingNextPage, hasNextPage, lastItemRef, refetch } = currentQuery;

  const counts = {
    confirmed: confirmedQuery.totalCount || confirmedQuery.friends.length,
    pending: pendingQuery.totalCount || pendingQuery.friends.length,
    sent: sentQuery.totalCount || sentQuery.friends.length,
  };

  const acceptMutation = useMutation({
    mutationFn: async (friendId: string) => {
      if (!me) throw new Error("Not authenticated");
      const friendUser = await me.user({ id: friendId });
      return friendUser.acceptFriendRequest();
    },
    onSuccess: () => {
      toast.success(t("toast.friends.requestAccepted"));
      refetch();
      queryClient.invalidateQueries({ queryKey: ["profile-friends"] });
    },
    onError: () => {
      toast.error(t("toast.friends.acceptRequestError"));
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (friendId: string) => {
      if (!me) throw new Error("Not authenticated");
      const friendUser = await me.user({ id: friendId });
      return friendUser.removeFriend();
    },
    onSuccess: () => {
      toast.success(t("toast.friends.requestRejected"));
      refetch();
      queryClient.invalidateQueries({ queryKey: ["profile-friends"] });
    },
    onError: () => {
      toast.error(t("toast.friends.rejectRequestError"));
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (friendId: string) => {
      if (!me) throw new Error("Not authenticated");
      const friendUser = await me.user({ id: friendId });
      return friendUser.removeFriend();
    },
    onSuccess: () => {
      toast.success(t("toast.friends.friendRemoved"));
      refetch();
      queryClient.invalidateQueries({ queryKey: ["profile-friends"] });
    },
    onError: () => {
      toast.error(t("toast.friends.removeError"));
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (friendId: string) => {
      if (!me) throw new Error("Not authenticated");
      const friendUser = await me.user({ id: friendId });
      return friendUser.removeFriend();
    },
    onSuccess: () => {
      toast.success(t("toast.friends.requestCancelled"));
      refetch();
      queryClient.invalidateQueries({ queryKey: ["profile-friends"] });
    },
    onError: () => {
      toast.error(t("toast.friends.cancelError"));
    },
  });

  const sendRequestMutation = useMutation({
    mutationFn: async (userId: string) => {
      if (!me) throw new Error("Not authenticated");
      const targetUser = await me.user({ id: userId });
      return targetUser.sendFriendRequest();
    },
    onSuccess: () => {
      toast.success(t("toast.friends.requestSent"));
      setAddFriendOpen(false);
      setAddFriendSearch("");
      refetch();
      queryClient.invalidateQueries({ queryKey: ["profile-friends"] });
    },
    onError: () => {
      toast.error(t("toast.friends.sendRequestError"));
    },
  });

  const renderFriendWithActions = (friend: User, isLastItem: boolean) => {
    const name = (friend.serverData?.name as string) || t("FriendsTab.anonymousFriend");
    const thumbUrl = friend.serverData?.profilImageUrl as string | undefined;
    const slug = friend.serverData?.slug as string | undefined;
    const friendId = friend.id || "";
    const isMutating = acceptMutation.isPending || rejectMutation.isPending ||
                      removeMutation.isPending || cancelMutation.isPending;

    return (
      <div
        key={friendId}
        ref={isLastItem ? lastItemRef as (node: HTMLDivElement | null) => void : undefined}
        className="flex items-center justify-between p-3 bg-background rounded-lg border border-border hover:shadow-sm transition-shadow"
      >
        <a href={slug ? `/@${slug}` : "#"} className="flex items-center gap-3 flex-1 min-w-0">
          <Avatar className="h-10 w-10 shrink-0">
            <AvatarImage src={thumbUrl} alt={name} />
            <AvatarFallback>{name.charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
          <span className="font-medium truncate">{name}</span>
        </a>

        {isOwnProfile && friendId && (
          <div className="flex items-center gap-2 shrink-0">
            {activeTab === "confirmed" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeMutation.mutate(friendId)}
                disabled={isMutating}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <UserMinus className="h-4 w-4 mr-1" />
                {t("SocialTab.removeFriend")}
              </Button>
            )}

            {activeTab === "pending" && (
              <>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => acceptMutation.mutate(friendId)}
                  disabled={isMutating}
                >
                  <Check className="h-4 w-4 mr-1" />
                  {t("SocialTab.accept")}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => rejectMutation.mutate(friendId)}
                  disabled={isMutating}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <X className="h-4 w-4 mr-1" />
                  {t("SocialTab.reject")}
                </Button>
              </>
            )}

            {activeTab === "sent" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => cancelMutation.mutate(friendId)}
                disabled={isMutating}
                className="text-muted-foreground"
              >
                <X className="h-4 w-4 mr-1" />
                {t("SocialTab.cancel")}
              </Button>
            )}
          </div>
        )}
      </div>
    );
  };

  if (!enabled) {
    return null;
  }

  if (isOwnProfile) {
    return (
      <div className="flex flex-col md:flex-row gap-6">
        <div className="md:w-56 shrink-0">
          <div className="flex flex-col gap-1">
            <button
              onClick={() => setActiveTab("confirmed")}
              className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-left transition-colors ${
                activeTab === "confirmed"
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted text-foreground"
              }`}
            >
              <span className="font-medium">{t("SocialTab.tabs.friends")}</span>
              {counts.confirmed > 0 && (
                <Badge
                  variant={activeTab === "confirmed" ? "secondary" : "outline"}
                  className="h-5 px-1.5 text-xs"
                >
                  {counts.confirmed}
                </Badge>
              )}
            </button>
            <button
              onClick={() => setActiveTab("pending")}
              className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-left transition-colors ${
                activeTab === "pending"
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted text-foreground"
              }`}
            >
              <span className="font-medium">{t("SocialTab.tabs.pending")}</span>
              {counts.pending > 0 && (
                <Badge
                  variant="destructive"
                  className="h-5 px-1.5 text-xs"
                >
                  {counts.pending}
                </Badge>
              )}
            </button>
            <button
              onClick={() => setActiveTab("sent")}
              className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-left transition-colors ${
                activeTab === "sent"
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted text-foreground"
              }`}
            >
              <span className="font-medium">{t("SocialTab.tabs.sent")}</span>
              {counts.sent > 0 && (
                <Badge
                  variant={activeTab === "sent" ? "secondary" : "outline"}
                  className="h-5 px-1.5 text-xs"
                >
                  {counts.sent}
                </Badge>
              )}
            </button>
          </div>

          <div className="mt-4">
            <Dialog open={addFriendOpen} onOpenChange={setAddFriendOpen}>
              <DialogTrigger asChild>
                <Button variant="default" size="sm" className="w-full">
                  <UserPlus className="h-4 w-4 mr-2" />
                  {t("SocialTab.addFriend")}
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>{t("FriendRequestDialog.title")}</DialogTitle>
                </DialogHeader>
                <AddFriendDialogContent
                  searchQuery={addFriendSearch}
                  setSearchQuery={setAddFriendSearch}
                  onSendRequest={(userId) => sendRequestMutation.mutate(userId)}
                  isLoading={sendRequestMutation.isPending}
                  t={t}
                  currentUserId={me?.id || undefined}
                  friends={friends}
                />
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          {/* Search bar */}
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("SocialTab.searchFriends")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <FriendList
            friends={friends}
            isLoading={isLoading}
            renderItem={renderFriendWithActions}
            emptyTitle={
              activeTab === "confirmed"
                ? t("SocialTab.noFriendsYet")
                : activeTab === "pending"
                ? t("SocialTab.noPendingRequests")
                : t("SocialTab.noSentRequests")
            }
            emptyDescription={
              activeTab === "confirmed"
                ? t("SocialTab.startConnecting")
                : activeTab === "pending"
                ? t("SocialTab.pendingRequestsInfo")
                : t("SocialTab.sentRequestsInfo")
            }
          />

          {isFetchingNextPage && (
            <div className="flex justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <EntityGridView<User>
      items={friends}
      isLoading={isLoading}
      isFetchingNextPage={isFetchingNextPage}
      hasNextPage={hasNextPage}
      renderGridItem={(item, isLastItem) => (
        <FriendItem
          key={item.id}
          item={item}
          isLastItem={isLastItem}
          lastItemRef={lastItemRef}
        />
      )}
      renderDetailedItem={(item, isLastItem) => (
        <FriendItemDetailed
          key={item.id}
          item={item}
          isLastItem={isLastItem}
          lastItemRef={lastItemRef}
        />
      )}
      emptyIcon={<Users className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 mx-auto" />}
      endIcon={<Users className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />}
      emptyTitle={t("FriendsTab.noFriends")}
      emptyDescription={t("FriendsTab.noFriendsDescription")}
      loadingText={t("FriendsTab.loadingFriends")}
      allLoadedTitle={t("FriendsTab.allFriendsLoaded")}
      allLoadedDescription={t("FriendsTab.allFriendsSeen")}
      gridViewLabel={t("FriendsTab.gridView")}
      detailedViewLabel={t("FriendsTab.detailedView")}
      showViewToggle={true}
      canCreate={false}
      searchEnabled
      searchValue={searchQuery}
      onSearchChange={setSearchQuery}
    />
  );
}

interface FriendListProps {
  friends: User[];
  isLoading: boolean;
  renderItem: (friend: User, isLastItem: boolean) => React.ReactNode;
  emptyTitle: string;
  emptyDescription: string;
}

function FriendList({ friends, isLoading, renderItem, emptyTitle, emptyDescription }: FriendListProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg animate-pulse">
            <div className="h-10 w-10 rounded-full bg-muted" />
            <div className="h-4 w-32 bg-muted rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (!friends || friends.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <h3 className="font-medium text-foreground">{emptyTitle}</h3>
        <p className="text-sm text-muted-foreground mt-1">{emptyDescription}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {friends.map((friend, index) => renderItem(friend, index === friends.length - 1))}
    </div>
  );
}

interface AddFriendDialogContentProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onSendRequest: (userId: string) => void;
  isLoading: boolean;
  t: (key: string) => string;
  currentUserId?: string;
  friends: User[];
}

function AddFriendDialogContent({
  searchQuery,
  setSearchQuery,
  onSendRequest,
  isLoading,
  t,
  currentUserId,
  friends,
}: AddFriendDialogContentProps) {
  const { data: searchResults, isLoading: isSearching } = useSearchUsers(searchQuery, searchQuery.length >= 2);

  const filteredResults = searchResults?.filter((user: SearchedUser) => {
    if (user.id === currentUserId) return false;
    if (friends?.some((f) => f.id === user.id)) return false;
    return true;
  }) || [];

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={t("FriendRequestDialog.searchPlaceholder")}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
          autoFocus
        />
      </div>

      <div className="max-h-64 overflow-y-auto">
        {searchQuery.length < 2 ? (
          <p className="text-center text-muted-foreground py-8">
            {t("FriendRequestDialog.minimumChars")}
          </p>
        ) : isSearching ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredResults.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">{t("FriendRequestDialog.noUsersFound")}</p>
            <p className="text-sm text-muted-foreground mt-1">{t("FriendRequestDialog.tryDifferentSearch")}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredResults.map((user: SearchedUser) => (
              <div
                key={user.id}
                className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={user.profilThumbImageUrl} alt={user.name} />
                    <AvatarFallback>{user.name?.charAt(0)?.toUpperCase() || "?"}</AvatarFallback>
                  </Avatar>
                  <span className="font-medium">{user.name}</span>
                </div>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => onSendRequest(user.id)}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <UserPlus className="h-4 w-4 mr-1" />
                      {t("FriendRequestDialog.sendRequest")}
                    </>
                  )}
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
