import { Briefcase } from "lucide-react";
import { useState } from "react";
import { useProfileEntity } from "../../hooks/useProfileEntity";
import { useLazyTab } from "@/hooks/useLazyTab";
import { useProfilProjectsQuery } from "../../hooks/useProfilProjectsQuery";
import { useProfileMutations } from "../../hooks/useProfileMutations";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import "@/modules/profil/i18n";
import { ProjectItem } from "../projects/ProjectItem";
import { ProjectItemDetailed } from "../projects/ProjectItemDetailed";
import { EntityGridView } from "../shared/EntityGridView";
import { AddProjectModal } from "../projects/AddProjectModal";
import type { Project } from "@communecter/cocolight-api-client";

export function ProjectsTab() {
  const { entity, entityType } = useProfileEntity();
  useLoadNamespace("modules/profil");
  const t = useT("modules/profil");
  const { canEdit } = useProfileMutations();
  const [showAddProjectModal, setShowAddProjectModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const { shouldLoad } = useLazyTab("projects");

  const {
    projects,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    lastItemRef,
  } = useProfilProjectsQuery({
    entity,
    entityType,
    enabled: shouldLoad,
    indexStep: 12,
    searchQuery,
  });

  if (!shouldLoad) {
    return null;
  }

  return (
    <>
      <EntityGridView<Project>
        items={projects}
        isLoading={isLoading}
        isFetchingNextPage={isFetchingNextPage}
        hasNextPage={hasNextPage}
        renderGridItem={(item, isLastItem) => (
          <ProjectItem
            key={item.id}
            item={item}
            isLastItem={isLastItem}
            lastItemRef={lastItemRef}
          />
        )}
        renderDetailedItem={(item, isLastItem) => (
          <ProjectItemDetailed
            key={item.id}
            item={item}
            isLastItem={isLastItem}
            lastItemRef={lastItemRef}
          />
        )}
        emptyIcon={<Briefcase className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 mx-auto" />}
        endIcon={<Briefcase className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />}
        emptyTitle={t("ProjectsTab.noProjects")}
        emptyDescription={t("ProjectsTab.noProjectsDescription")}
        loadingText={t("ProjectsTab.loadingProjects")}
        allLoadedTitle={t("ProjectsTab.allProjectsLoaded")}
        allLoadedDescription={t("ProjectsTab.allProjectsSeen")}
        gridViewLabel={t("ProjectsTab.gridView")}
        detailedViewLabel={t("ProjectsTab.detailedView")}
        createLabel={t("ProjectsTab.createProject")}
        canCreate={canEdit}
        onCreateClick={() => setShowAddProjectModal(true)}
        searchEnabled
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
      />

      <AddProjectModal
        entity={entity}
        open={showAddProjectModal}
        onOpenChange={setShowAddProjectModal}
      />
    </>
  );
}
