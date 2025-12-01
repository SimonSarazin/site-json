import { Users } from "lucide-react";
import { useState } from "react";
import { useProfileEntity } from "../../hooks/useProfileEntity";
import { useProfilContributorsQuery } from "../../hooks/useProfilContributorsQuery";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import "@/modules/profil/i18n";
import { ContributorItem } from "./ContributorItem";
import { ContributorItemDetailed } from "./ContributorItemDetailed";
import { EntityGridView } from "../shared/EntityGridView";
import type { User, Organization } from "@communecter/cocolight-api-client";

interface ContributorsTabProps {
  enabled?: boolean;
}

export function ContributorsTab({ enabled = true }: ContributorsTabProps) {
  const { entity, entityType } = useProfileEntity();
  useLoadNamespace("modules/profil");
  const t = useT("modules/profil");
  const [searchQuery, setSearchQuery] = useState("");

  const {
    contributors,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    lastItemRef,
  } = useProfilContributorsQuery({
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
    <EntityGridView<User | Organization>
      items={contributors}
      isLoading={isLoading}
      isFetchingNextPage={isFetchingNextPage}
      hasNextPage={hasNextPage}
      renderGridItem={(item, isLastItem) => (
        <ContributorItem
          key={item.id}
          item={item}
          isLastItem={isLastItem}
          lastItemRef={lastItemRef}
        />
      )}
      renderDetailedItem={(item, isLastItem) => (
        <ContributorItemDetailed
          key={item.id}
          item={item}
          isLastItem={isLastItem}
          lastItemRef={lastItemRef}
        />
      )}
      emptyIcon={<Users className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 mx-auto" />}
      endIcon={<Users className="w-5 h-5 sm:w-6 sm:h-6 text-teal-600 dark:text-teal-400" />}
      emptyTitle={t("ContributorsTab.noContributors")}
      emptyDescription={t("ContributorsTab.noContributorsDescription")}
      loadingText={t("ContributorsTab.loadingContributors")}
      allLoadedTitle={t("ContributorsTab.allContributorsLoaded")}
      allLoadedDescription={t("ContributorsTab.allContributorsSeen")}
      gridViewLabel={t("ContributorsTab.gridView")}
      detailedViewLabel={t("ContributorsTab.detailedView")}
      showViewToggle={true}
      canCreate={false}
      searchEnabled
      searchValue={searchQuery}
      onSearchChange={setSearchQuery}
    />
  );
}
