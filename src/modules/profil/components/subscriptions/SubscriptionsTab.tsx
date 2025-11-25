import { Heart } from "lucide-react";
import { useState } from "react";
import { useProfileEntity } from "../../hooks/useProfileEntity";
import { useProfilSubscriptionsQuery } from "../../hooks/useProfilSubscriptionsQuery";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import "@/modules/profil/i18n";
import { SubscriptionItem } from "./SubscriptionItem";
import { SubscriptionItemDetailed } from "./SubscriptionItemDetailed";
import { EntityGridView } from "../shared/EntityGridView";
import type { EntityTypes } from "@communecter/cocolight-api-client";

interface SubscriptionsTabProps {
  enabled?: boolean;
}

export function SubscriptionsTab({ enabled = true }: SubscriptionsTabProps) {
  const { entity, entityType } = useProfileEntity();
  useLoadNamespace("modules/profil");
  const t = useT("modules/profil");
  const [searchQuery, setSearchQuery] = useState("");

  const {
    subscriptions,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    lastItemRef,
  } = useProfilSubscriptionsQuery({
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
    <EntityGridView<EntityTypes>
      items={subscriptions}
      isLoading={isLoading}
      isFetchingNextPage={isFetchingNextPage}
      hasNextPage={hasNextPage}
      renderGridItem={(item, isLastItem) => (
        <SubscriptionItem
          key={item.id}
          item={item}
          isLastItem={isLastItem}
          lastItemRef={lastItemRef}
        />
      )}
      renderDetailedItem={(item, isLastItem) => (
        <SubscriptionItemDetailed
          key={item.id}
          item={item}
          isLastItem={isLastItem}
          lastItemRef={lastItemRef}
        />
      )}
      emptyIcon={<Heart className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 mx-auto" />}
      endIcon={<Heart className="w-5 h-5 sm:w-6 sm:h-6 text-teal-600 dark:text-teal-400" />}
      emptyTitle={t("SubscriptionsTab.noSubscriptions")}
      emptyDescription={t("SubscriptionsTab.noSubscriptionsDescription")}
      loadingText={t("SubscriptionsTab.loadingSubscriptions")}
      allLoadedTitle={t("SubscriptionsTab.allSubscriptionsLoaded")}
      allLoadedDescription={t("SubscriptionsTab.allSubscriptionsSeen")}
      gridViewLabel={t("SubscriptionsTab.gridView")}
      detailedViewLabel={t("SubscriptionsTab.detailedView")}
      showViewToggle={true}
      canCreate={false}
      searchEnabled
      searchValue={searchQuery}
      onSearchChange={setSearchQuery}
    />
  );
}
