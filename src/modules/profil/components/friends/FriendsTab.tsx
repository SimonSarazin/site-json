import { Users } from "lucide-react";
import { useState } from "react";
import { useProfileEntity } from "../../hooks/useProfileEntity";
import { useProfilFriendsQuery } from "../../hooks/useProfilFriendsQuery";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import "@/modules/profil/i18n";
import { FriendItem } from "./FriendItem";
import { FriendItemDetailed } from "./FriendItemDetailed";
import { EntityGridView } from "../shared/EntityGridView";
import type { User } from "@communecter/cocolight-api-client";

interface FriendsTabProps {
  enabled?: boolean;
}

export function FriendsTab({ enabled = true }: FriendsTabProps) {
  const { entity, entityType } = useProfileEntity();
  useLoadNamespace("modules/profil");
  const t = useT("modules/profil");
  const [searchQuery, setSearchQuery] = useState("");

  const {
    friends,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    lastItemRef,
  } = useProfilFriendsQuery({
    entity,
    entityType,
    enabled,
    indexStep: 12,
    searchQuery,
  });

  if (!enabled) {
    return null;
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
      endIcon={<Users className="w-5 h-5 sm:w-6 sm:h-6 text-teal-600 dark:text-teal-400" />}
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
