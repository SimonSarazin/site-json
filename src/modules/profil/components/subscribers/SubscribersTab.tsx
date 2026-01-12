import { Users } from "lucide-react";
import { useState } from "react";
import { useProfileEntity } from "../../hooks/useProfileEntity";
import { useProfilSubscribersQuery } from "../../hooks/useProfilSubscribersQuery";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import "@/modules/profil/i18n";
import { SubscriberItem } from "./SubscriberItem";
import { SubscriberItemDetailed } from "./SubscriberItemDetailed";
import { EntityGridView } from "../shared/EntityGridView";
import type { User } from "@communecter/cocolight-api-client";

interface SubscribersTabProps {
  enabled?: boolean;
}

export function SubscribersTab({ enabled = true }: SubscribersTabProps) {
  const { entity, entityType } = useProfileEntity();
  useLoadNamespace("modules/profil");
  const t = useT("modules/profil");
  const [searchQuery, setSearchQuery] = useState("");

  const {
    subscribers,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    lastItemRef,
  } = useProfilSubscribersQuery({
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
      items={subscribers}
      isLoading={isLoading}
      isFetchingNextPage={isFetchingNextPage}
      hasNextPage={hasNextPage}
      renderGridItem={(item, isLastItem) => (
        <SubscriberItem
          key={item.id}
          item={item}
          isLastItem={isLastItem}
          lastItemRef={lastItemRef}
        />
      )}
      renderDetailedItem={(item, isLastItem) => (
        <SubscriberItemDetailed
          key={item.id}
          item={item}
          isLastItem={isLastItem}
          lastItemRef={lastItemRef}
        />
      )}
      emptyIcon={<Users className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 mx-auto" />}
      endIcon={<Users className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />}
      emptyTitle={t("SubscribersTab.noSubscribers")}
      emptyDescription={t("SubscribersTab.noSubscribersDescription")}
      loadingText={t("SubscribersTab.loadingSubscribers")}
      allLoadedTitle={t("SubscribersTab.allSubscribersLoaded")}
      allLoadedDescription={t("SubscribersTab.allSubscribersSeen")}
      gridViewLabel={t("SubscribersTab.gridView")}
      detailedViewLabel={t("SubscribersTab.detailedView")}
      showViewToggle={true}
      canCreate={false}
      searchEnabled
      searchValue={searchQuery}
      onSearchChange={setSearchQuery}
    />
  );
}
