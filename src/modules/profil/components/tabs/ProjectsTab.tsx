import { Briefcase, Loader2, Plus, LayoutGrid, List } from "lucide-react";
import { useState } from "react";
import { useProfileEntity } from "../../hooks/useProfileEntity";
import { useLazyTab } from "@/hooks/useLazyTab";
import { useProfilProjectsQuery } from "../../hooks/useProfilProjectsQuery";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { useCocolight } from "@/hooks/useCocolight";
import { Button } from "@/components/ui/button";
import "@/modules/profil/i18n";
import { ProjectItem } from "../projects/ProjectItem";
import { ProjectItemDetailed } from "../projects/ProjectItemDetailed";

export function ProjectsTab() {
  const { entity, entityType } = useProfileEntity();
  useLoadNamespace("modules/profil");
  const t = useT("modules/profil");
  const { me } = useCocolight();
  const [showAddProjectModal, setShowAddProjectModal] = useState(false);
  const [isDetailedView, setIsDetailedView] = useState(false);

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
  });

  if (!shouldLoad) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="bg-background p-6 sm:p-8 rounded-lg border border-border shadow-sm">
        <div className="text-center py-12 sm:py-16">
          <div className="animate-pulse space-y-3 sm:space-y-4">
            <div className="h-10 w-10 sm:h-12 sm:w-12 bg-muted rounded-full mx-auto"></div>
            <div className="h-3 sm:h-4 bg-muted rounded w-1/2 mx-auto"></div>
            <div className="h-2 sm:h-3 bg-muted rounded w-1/3 mx-auto"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!projects || projects.length === 0) {
    return (
      <div className="bg-background p-6 sm:p-8 rounded-lg border border-border shadow-sm">
        <div className="text-center py-12 sm:py-16">
          <div className="text-muted-foreground mb-3 sm:mb-4">
            <Briefcase className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 mx-auto" />
          </div>
          <p className="text-lg sm:text-xl font-semibold text-foreground mb-1 sm:mb-2 px-4">
            {t("ProjectsTab.noProjects")}
          </p>
          <p className="text-sm sm:text-base text-muted-foreground px-4">
            {t("ProjectsTab.noProjectsDescription")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4 sm:space-y-6">
        <div className="flex justify-between items-center gap-2">
          <div className="flex gap-2">
            <Button
              variant={!isDetailedView ? "default" : "outline"}
              size="sm"
              onClick={() => setIsDetailedView(false)}
              className={!isDetailedView ? "bg-teal-600 hover:bg-teal-700 text-white" : ""}
            >
              <LayoutGrid className="w-4 h-4 mr-2" />
              {t("ProjectsTab.gridView")}
            </Button>
            <Button
              variant={isDetailedView ? "default" : "outline"}
              size="sm"
              onClick={() => setIsDetailedView(true)}
              className={isDetailedView ? "bg-teal-600 hover:bg-teal-700 text-white" : ""}
            >
              <List className="w-4 h-4 mr-2" />
              {t("ProjectsTab.detailedView")}
            </Button>
          </div>
          {me?.isConnected && (
            <Button
              onClick={() => setShowAddProjectModal(true)}
              className="bg-teal-600 hover:bg-teal-700 text-xs sm:text-sm text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              {t("ProjectsTab.createProject")}
            </Button>
          )}
        </div>

        {!isDetailedView && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((item, index) => (
              <ProjectItem
                key={item.id}
                item={item}
                isLastItem={index === projects.length - 1}
                lastItemRef={lastItemRef}
              />
            ))}
          </div>
        )}

        {isDetailedView && (
          <div className="space-y-4">
            {projects.map((item, index) => (
              <ProjectItemDetailed
                key={item.id}
                item={item}
                isLastItem={index === projects.length - 1}
                lastItemRef={lastItemRef}
              />
            ))}
          </div>
        )}

        {isFetchingNextPage && (
          <div className="bg-background p-8 rounded-xl border border-border shadow-sm">
            <div className="text-center">
              <Loader2 className="w-10 h-10 animate-spin mx-auto text-teal-600" />
              <p className="text-sm text-muted-foreground mt-3 font-medium">
                {t("ProjectsTab.loadingProjects")}
              </p>
            </div>
          </div>
        )}

        {!hasNextPage && projects.length > 0 && (
          <div className="bg-background p-6 sm:p-8 rounded-xl border border-border shadow-sm">
            <div className="text-center">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-teal-100 dark:bg-teal-900/30 rounded-full flex items-center justify-center mx-auto mb-2 sm:mb-3">
                <Briefcase className="w-5 h-5 sm:w-6 sm:h-6 text-teal-600 dark:text-teal-400" />
              </div>
              <p className="text-sm sm:text-base text-foreground font-semibold mb-1">
                {t("ProjectsTab.allProjectsLoaded")}
              </p>
              <p className="text-xs sm:text-sm text-muted-foreground">
                {t("ProjectsTab.allProjectsSeen")}
              </p>
            </div>
          </div>
        )}
      </div>

      {showAddProjectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background rounded-lg p-6 max-w-md w-full">
            <h2 className="text-xl font-semibold mb-4">Modal à implémenter</h2>
            <p className="text-muted-foreground mb-4">
              Le modal pour ajouter un projet sera implémenté prochainement.
            </p>
            <Button onClick={() => setShowAddProjectModal(false)}>
              Fermer
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
