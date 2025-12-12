import { Building2 } from "lucide-react";
import { useState } from "react";
import { useProfileEntity } from "../../hooks/useProfileEntity";
import { useProfilOrganizationsQuery } from "../../hooks/useProfilOrganizationsQuery";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { useCocolight } from "@/hooks/useCocolight";
import "@/modules/profil/i18n";
import { OrganizationItem } from "./OrganizationItem";
import { OrganizationItemDetailed } from "./OrganizationItemDetailed";
import { EntityGridView } from "../shared/EntityGridView";
import { AddOrganizationModal } from "./AddOrganizationModal";
import type { Organization } from "@communecter/cocolight-api-client";

interface OrganizationsTabProps {
  enabled?: boolean;
}

export function OrganizationsTab({ enabled = true }: OrganizationsTabProps) {
  const { entity, entityType } = useProfileEntity();
  useLoadNamespace("modules/profil");
  const t = useT("modules/profil");
  const { me } = useCocolight();
  const [showAddOrganizationModal, setShowAddOrganizationModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const {
    organizations,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    lastItemRef,
  } = useProfilOrganizationsQuery({
    entity,
    entityType,
    enabled,
    indexStep: 12,
    searchQuery,
  });

  const canCreate = me?.isConnected;

  return (
    <>
      <EntityGridView<Organization>
        items={organizations}
        isLoading={isLoading}
        isFetchingNextPage={isFetchingNextPage}
        hasNextPage={hasNextPage}
        renderGridItem={(item, isLastItem) => (
          <OrganizationItem
            key={item.id}
            item={item}
            isLastItem={isLastItem}
            lastItemRef={lastItemRef}
          />
        )}
        renderDetailedItem={(item, isLastItem) => (
          <OrganizationItemDetailed
            key={item.id}
            item={item}
            isLastItem={isLastItem}
            lastItemRef={lastItemRef}
          />
        )}
        emptyIcon={<Building2 className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 mx-auto" />}
        endIcon={<Building2 className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />}
        emptyTitle={t("OrganizationsTab.noOrganizations")}
        emptyDescription={t("OrganizationsTab.noOrganizationsDescription")}
        loadingText={t("OrganizationsTab.loadingOrganizations")}
        allLoadedTitle={t("OrganizationsTab.allOrganizationsLoaded")}
        allLoadedDescription={t("OrganizationsTab.allOrganizationsSeen")}
        gridViewLabel={t("OrganizationsTab.gridView")}
        detailedViewLabel={t("OrganizationsTab.detailedView")}
        createLabel={t("OrganizationsTab.createOrganization")}
        canCreate={canCreate}
        onCreateClick={() => setShowAddOrganizationModal(true)}
        showViewToggle={true}
        searchEnabled
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
      />

      <AddOrganizationModal
        open={showAddOrganizationModal}
        onOpenChange={setShowAddOrganizationModal}
      />
    </>
  );
}
