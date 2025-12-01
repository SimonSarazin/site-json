import { Users } from "lucide-react";
import { useState } from "react";
import { useProfileEntity } from "../../hooks/useProfileEntity";
import { useProfilMembersQuery } from "../../hooks/useProfilMembersQuery";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import "@/modules/profil/i18n";
import { MemberItem } from "./MemberItem";
import { MemberItemDetailed } from "./MemberItemDetailed";
import { EntityGridView } from "../shared/EntityGridView";
import type { User, Organization } from "@communecter/cocolight-api-client";

interface MembersTabProps {
  enabled?: boolean;
}

export function MembersTab({ enabled = true }: MembersTabProps) {
  const { entity, entityType } = useProfileEntity();
  useLoadNamespace("modules/profil");
  const t = useT("modules/profil");
  const [searchQuery, setSearchQuery] = useState("");

  const {
    members,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    lastItemRef,
  } = useProfilMembersQuery({
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
      items={members}
      isLoading={isLoading}
      isFetchingNextPage={isFetchingNextPage}
      hasNextPage={hasNextPage}
      renderGridItem={(item, isLastItem) => (
        <MemberItem
          key={item.id}
          item={item}
          isLastItem={isLastItem}
          lastItemRef={lastItemRef}
        />
      )}
      renderDetailedItem={(item, isLastItem) => (
        <MemberItemDetailed
          key={item.id}
          item={item}
          isLastItem={isLastItem}
          lastItemRef={lastItemRef}
        />
      )}
      emptyIcon={<Users className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 mx-auto" />}
      endIcon={<Users className="w-5 h-5 sm:w-6 sm:h-6 text-teal-600 dark:text-teal-400" />}
      emptyTitle={t("MembersTab.noMembers")}
      emptyDescription={t("MembersTab.noMembersDescription")}
      loadingText={t("MembersTab.loadingMembers")}
      allLoadedTitle={t("MembersTab.allMembersLoaded")}
      allLoadedDescription={t("MembersTab.allMembersSeen")}
      gridViewLabel={t("MembersTab.gridView")}
      detailedViewLabel={t("MembersTab.detailedView")}
      showViewToggle={true}
      canCreate={false}
      searchEnabled
      searchValue={searchQuery}
      onSearchChange={setSearchQuery}
    />
  );
}
