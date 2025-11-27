import { useState } from "react";
import { Search, Users, UserPlus, Clock, UserMinus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useT } from "@/hooks/useT";
import { useProfileEntity } from "../../hooks/useProfileEntity";
import { useFriendsQuery } from "../../hooks/useFriendsQuery";
import { useAcceptFriendRequest, useRejectFriendRequest, useRemoveFriend, useCancelFriendRequest } from "../../hooks/useFriendMutations";
import { useCocolight } from "@/hooks/useCocolight";
import { FriendRequestDialog } from "../social/FriendRequestDialog";
import type { User } from "@communecter/cocolight-api-client";

export function SocialTab() {
  const { entity } = useProfileEntity();
  const { me } = useCocolight();
  const t = useT("modules/profil");
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("friends");

  // Queries - utilisation du hook unifié avec les 4 statuts
  const {
    friends,
    totalCount: friendsCount,
    isLoading: friendsLoading,
    isFetchingNextPage: friendsFetching,
    lastItemRef: friendsLastRef,
    hasNextPage: friendsHasNext
  } = useFriendsQuery(entity, {
    search: searchTerm,
    status: "friends",
    indexStep: 20
  });

  const {
    friends: pendingRequests,
    totalCount: pendingCount,
    isLoading: pendingLoading,
    isFetchingNextPage: pendingFetching,
    lastItemRef: pendingLastRef,
    hasNextPage: pendingHasNext
  } = useFriendsQuery(entity, {
    status: "pending",
    indexStep: 20
  });

  const {
    friends: sentRequests,
    totalCount: sentCount,
    isLoading: sentLoading,
    isFetchingNextPage: sentFetching,
    lastItemRef: sentLastRef,
    hasNextPage: sentHasNext
  } = useFriendsQuery(entity, {
    search: searchTerm,
    status: "sent",
    indexStep: 20
  });

  // Mutations
  const acceptFriendMutation = useAcceptFriendRequest(me);
  const rejectFriendMutation = useRejectFriendRequest(me);
  const removeFriendMutation = useRemoveFriend(me);
  const cancelRequestMutation = useCancelFriendRequest(me);

  const isOwnProfile = me?.slug === entity?.slug;

  if (!isOwnProfile) {
    return (
      <div className="bg-card p-8 rounded-lg border border-border shadow-sm">
        <div className="text-center py-16">
          <div className="text-gray-400 mb-4">
            <Users className="w-16 h-16 mx-auto" />
          </div>
          <p className="text-xl font-semibold text-foreground mb-2">{t("SocialTab.privateProfile")}</p>
          <p className="text-muted-foreground">{t("SocialTab.cannotViewFriends")}</p>
        </div>
      </div>
    );
  }

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
            {friendsCount > 0 && (
              <span className="ml-1 text-xs bg-muted px-1.5 py-0.5 rounded-full">
                {friendsCount}
              </span>
            )}
          </TabsTrigger>

          <TabsTrigger value="pending" className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            <span className="hidden sm:inline">{t("SocialTab.tabs.pending")}</span>
            <span className="sm:hidden">{t("SocialTab.tabs.pendingShort")}</span>
            {pendingCount > 0 && (
              <span className="ml-1 text-xs bg-orange-100 text-orange-800 px-1.5 py-0.5 rounded-full">
                {pendingCount}
              </span>
            )}
          </TabsTrigger>

          <TabsTrigger value="sent" className="flex items-center gap-2">
            <UserPlus className="w-4 h-4" />
            <span className="hidden sm:inline">{t("SocialTab.tabs.sent")}</span>
            <span className="sm:hidden">{t("SocialTab.tabs.sentShort")}</span>
            {sentCount > 0 && (
              <span className="ml-1 text-xs bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded-full">
                {sentCount}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="friends">
          <div className="bg-card rounded-lg border border-border">
            {friendsLoading ? (
              <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600 mx-auto"></div>
                <p className="text-muted-foreground mt-2">{t("common.loading")}</p>
              </div>
            ) : friends.length === 0 ? (
              <div className="p-8 text-center">
                <Users className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                <p className="text-foreground font-medium mb-2">
                  {searchTerm ? t("SocialTab.noFriendsFound") : t("SocialTab.noFriendsYet")}
                </p>
                <p className="text-muted-foreground text-sm">
                  {searchTerm ? t("SocialTab.tryDifferentSearch") : t("SocialTab.startConnecting")}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {friends.map((friend: any, index: number) => (
                  <div
                    key={friend.id}
                    className="p-4 flex items-center justify-between hover:bg-muted/50"
                    ref={index === friends.length - 1 ? friendsLastRef : undefined}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={friend.serverData?.profilImageUrl} />
                        <AvatarFallback>
                          {friend.serverData?.name?.charAt(0) || "?"}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <h3 className="font-medium text-foreground">
                          {friend.serverData?.name || t("common.unknownUser")}
                        </h3>
                        {friend.serverData?.username && (
                          <p className="text-sm text-muted-foreground">
                            @{friend.serverData.username}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => removeFriendMutation.mutate({ user: friend })}
                        disabled={removeFriendMutation.isPending}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <UserMinus className="w-4 h-4" />
                        <span className="hidden sm:inline ml-1">
                          {t("SocialTab.removeFriend")}
                        </span>
                      </Button>
                    </div>
                  </div>
                ))}
                {friendsFetching && (
                  <div className="p-4 text-center border-t">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-teal-600 mx-auto"></div>
                    <p className="text-muted-foreground text-sm mt-2">{t("common.loading")}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="pending">
          <div className="bg-card rounded-lg border border-border">
            {pendingLoading ? (
              <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600 mx-auto"></div>
                <p className="text-muted-foreground mt-2">{t("common.loading")}</p>
              </div>
            ) : pendingRequests.length === 0 ? (
              <div className="p-8 text-center">
                <Clock className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                <p className="text-foreground font-medium mb-2">{t("SocialTab.noPendingRequests")}</p>
                <p className="text-muted-foreground text-sm">{t("SocialTab.pendingRequestsInfo")}</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {pendingRequests.map((user, index: number) => (
                  <div
                    key={user.id}
                    className="p-4 flex items-center justify-between"
                    ref={index === pendingRequests.length - 1 ? pendingLastRef : undefined}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={user.serverData?.profilImageUrl} />
                        <AvatarFallback>
                          {user.serverData?.name?.charAt(0) || "?"}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <h3 className="font-medium text-foreground">
                          {user.serverData?.name || t("common.unknownUser")}
                        </h3>
                        {user.serverData?.username && (
                          <p className="text-sm text-muted-foreground">
                            @{user.serverData.username}
                          </p>
                        )}
                      </div>
                    </div>
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
                  </div>
                ))}
                {pendingFetching && (
                  <div className="p-4 text-center border-t">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-teal-600 mx-auto"></div>
                    <p className="text-muted-foreground text-sm mt-2">{t("common.loading")}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="sent">
          <div className="bg-card rounded-lg border border-border">
            {sentLoading ? (
              <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600 mx-auto"></div>
                <p className="text-muted-foreground mt-2">{t("common.loading")}</p>
              </div>
            ) : sentRequests.length === 0 ? (
              <div className="p-8 text-center">
                <UserPlus className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                <p className="text-foreground font-medium mb-2">{t("SocialTab.noSentRequests")}</p>
                <p className="text-muted-foreground text-sm">{t("SocialTab.sentRequestsInfo")}</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {sentRequests.map((user, index: number) => (
                  <div
                    key={user.id}
                    className="p-4 flex items-center justify-between"
                    ref={index === sentRequests.length - 1 ? sentLastRef : undefined}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={user.serverData?.profilImageUrl} />
                        <AvatarFallback>
                          {user.serverData?.name?.charAt(0) || "?"}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <h3 className="font-medium text-foreground">
                          {user.serverData?.name || t("common.unknownUser")}
                        </h3>
                        {user.serverData?.username && (
                          <p className="text-sm text-muted-foreground">
                            @{user.serverData.username}
                          </p>
                        )}
                        <p className="text-xs text-orange-600">{t("SocialTab.requestPending")}</p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => cancelRequestMutation.mutate({ user })}
                      disabled={cancelRequestMutation.isPending}
                      className="text-red-600 hover:text-red-700"
                    >
                      {t("SocialTab.cancel")}
                    </Button>
                  </div>
                ))}
                {sentFetching && (
                  <div className="p-4 text-center border-t">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-teal-600 mx-auto"></div>
                    <p className="text-muted-foreground text-sm mt-2">{t("common.loading")}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}