import { useState } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { Search, Users, UserPlus, Clock, UserMinus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { User } from "@communecter/cocolight-api-client";
import { useT } from "@/hooks/useT";
import { useProfileEntity } from "../../hooks/useProfileEntity";
import { useFriendsQuery } from "../../hooks/useFriendsQuery";
import {
  useAcceptFriendRequest,
  useRejectFriendRequest,
  useRemoveFriend,
  useCancelFriendRequest,
} from "../../hooks/useFriendMutations";
import { useCocolight } from "@/hooks/useCocolight";
import { FriendRequestDialog } from "../social/FriendRequestDialog";
import { LoadingState, EmptyState, UserListItem, CountBadge } from "../shared";

export function SocialTab() {
  const { entity } = useProfileEntity();
  const { me } = useCocolight();
  const t = useT("modules/profil");
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("friends");
  const debouncedSearch = useDebounce(searchTerm, 300);

  // Queries
  const {
    friends,
    totalCount: friendsCount,
    isLoading: friendsLoading,
    isFetchingNextPage: friendsFetching,
    lastItemRef: friendsLastRef,
  } = useFriendsQuery(entity, { search: debouncedSearch, status: "friends", indexStep: 20 });

  const {
    friends: pendingRequests,
    totalCount: pendingCount,
    isLoading: pendingLoading,
    isFetchingNextPage: pendingFetching,
    lastItemRef: pendingLastRef,
  } = useFriendsQuery(entity, { status: "pending", indexStep: 20 });

  const {
    friends: sentRequests,
    totalCount: sentCount,
    isLoading: sentLoading,
    isFetchingNextPage: sentFetching,
    lastItemRef: sentLastRef,
  } = useFriendsQuery(entity, { search: debouncedSearch, status: "sent", indexStep: 20 });

  // Mutations
  const acceptFriendMutation = useAcceptFriendRequest(me);
  const rejectFriendMutation = useRejectFriendRequest(me);
  const removeFriendMutation = useRemoveFriend(me);
  const cancelRequestMutation = useCancelFriendRequest(me);

  const isOwnProfile = me?.slug === entity?.slug;

  if (!isOwnProfile) {
    return (
      <div className="bg-card p-8 rounded-lg border border-border shadow-sm">
        <EmptyState
          icon={Users}
          title={t("SocialTab.privateProfile")}
          description={t("SocialTab.cannotViewFriends")}
          variant="default"
        />
      </div>
    );
  }

  // Rendu du contenu d'un onglet
  const renderTabContent = (
    isLoading: boolean,
    items: User[],
    emptyIcon: typeof Users,
    emptyTitle: string,
    emptyDescription: string,
    isFetching: boolean,
    lastRef: (node: HTMLElement | null) => void,
    renderActions: (user: User) => React.ReactNode,
    renderSubtitle?: (user: User) => string | undefined
  ) => {
    if (isLoading) {
      return <LoadingState variant="spinner" />;
    }

    if (items.length === 0) {
      return (
        <EmptyState
          icon={emptyIcon}
          title={emptyTitle}
          description={emptyDescription}
          variant="default"
        />
      );
    }

    return (
      <>
        <div className="divide-y divide-border">
          {items.map((user: User, index: number) => (
            <UserListItem
              key={user.id}
              ref={index === items.length - 1 ? lastRef : undefined}
              user={user}
              subtitle={renderSubtitle?.(user)}
              actions={renderActions(user)}
            />
          ))}
        </div>
        {isFetching && <LoadingState variant="spinner" size="sm" />}
      </>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header avec recherche */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder={t("SocialTab.searchFriends")}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <FriendRequestDialog />
      </div>

      {/* Onglets */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="friends" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            <span className="hidden sm:inline">{t("SocialTab.tabs.friends")}</span>
            <span className="sm:hidden">{t("SocialTab.tabs.friendsShort")}</span>
            <CountBadge count={friendsCount} colorScheme="muted" />
          </TabsTrigger>

          <TabsTrigger value="pending" className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            <span className="hidden sm:inline">{t("SocialTab.tabs.pending")}</span>
            <span className="sm:hidden">{t("SocialTab.tabs.pendingShort")}</span>
            <CountBadge count={pendingCount} colorScheme="orange" />
          </TabsTrigger>

          <TabsTrigger value="sent" className="flex items-center gap-2">
            <UserPlus className="w-4 h-4" />
            <span className="hidden sm:inline">{t("SocialTab.tabs.sent")}</span>
            <span className="sm:hidden">{t("SocialTab.tabs.sentShort")}</span>
            <CountBadge count={sentCount} colorScheme="blue" />
          </TabsTrigger>
        </TabsList>

        <TabsContent value="friends">
          <div className="bg-card rounded-lg border border-border">
            {renderTabContent(
              friendsLoading,
              friends,
              Users,
              searchTerm ? t("SocialTab.noFriendsFound") : t("SocialTab.noFriendsYet"),
              searchTerm ? t("SocialTab.tryDifferentSearch") : t("SocialTab.startConnecting"),
              friendsFetching,
              friendsLastRef,
              (friend) => (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => removeFriendMutation.mutate({ user: friend })}
                  disabled={removeFriendMutation.isPending}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <UserMinus className="w-4 h-4" />
                  <span className="hidden sm:inline ml-1">{t("SocialTab.removeFriend")}</span>
                </Button>
              )
            )}
          </div>
        </TabsContent>

        <TabsContent value="pending">
          <div className="bg-card rounded-lg border border-border">
            {renderTabContent(
              pendingLoading,
              pendingRequests,
              Clock,
              t("SocialTab.noPendingRequests"),
              t("SocialTab.pendingRequestsInfo"),
              pendingFetching,
              pendingLastRef,
              (user) => (
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => acceptFriendMutation.mutate({ user })}
                    disabled={acceptFriendMutation.isPending}
                    className="bg-teal-600 hover:bg-teal-700"
                  >
                    {t("SocialTab.accept")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => rejectFriendMutation.mutate({ user })}
                    disabled={rejectFriendMutation.isPending}
                    className="text-red-600 hover:text-red-700"
                  >
                    {t("SocialTab.reject")}
                  </Button>
                </div>
              )
            )}
          </div>
        </TabsContent>

        <TabsContent value="sent">
          <div className="bg-card rounded-lg border border-border">
            {renderTabContent(
              sentLoading,
              sentRequests,
              UserPlus,
              t("SocialTab.noSentRequests"),
              t("SocialTab.sentRequestsInfo"),
              sentFetching,
              sentLastRef,
              (user) => (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => cancelRequestMutation.mutate({ user })}
                  disabled={cancelRequestMutation.isPending}
                  className="text-red-600 hover:text-red-700"
                >
                  {t("SocialTab.cancel")}
                </Button>
              ),
              (user) =>
                user.serverData?.username
                  ? `@${user.serverData.username} - ${t("SocialTab.requestPending")}`
                  : t("SocialTab.requestPending")
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
