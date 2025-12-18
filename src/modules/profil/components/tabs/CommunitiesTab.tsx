import { Users } from "lucide-react";
import { useState } from "react";
import { useProfileEntity } from "../../hooks/useProfileEntity";
import { useLazyTab } from "@/hooks/useLazyTab";
import { useProfileMutations } from "../../hooks/useProfileMutations";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import "@/modules/profil/i18n";
import { OrganizationsTab } from "../organizations/OrganizationsTab";
import { SubscriptionsTab } from "../subscriptions/SubscriptionsTab";
import { SubscribersTab } from "../subscribers/SubscribersTab";
import { FriendsTab } from "../friends/FriendsTab";
import { ContributorsTab } from "../contributors/ContributorsTab";
import { MembersTab } from "../members/MembersTab";
import { ProjectsTab } from "../projects/ProjectsTab";
import { useProfilOrganizationsQuery } from "../../hooks/useProfilOrganizationsQuery";
import { useProfilFriendsQuery } from "../../hooks/useProfilFriendsQuery";
import { useProfilProjectsQuery } from "../../hooks/useProfilProjectsQuery";
import { useCocolight } from "@/hooks/useCocolight";

export function CommunitiesTab() {
  const { entity, entityType } = useProfileEntity();
  useLoadNamespace("modules/profil");
  const t = useT("modules/profil");
  const { canEdit } = useProfileMutations();
  const { me } = useCocolight();

  const { shouldLoad } = useLazyTab("communities");
  const [isLoading] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<string | null>(null);

  const isOwnProfile = me?.id === entity?.id;

  const friendsQuery = useProfilFriendsQuery({
    entity,
    entityType,
    enabled: shouldLoad && entityType === "citoyens",
    indexStep: 1,
    status: isOwnProfile ? "confirmed" : "all",
  });

  const organizationsQuery = useProfilOrganizationsQuery({
    entity,
    entityType,
    enabled: shouldLoad && entityType === "citoyens",
    indexStep: 1,
  });

  const projectsQuery = useProfilProjectsQuery({
    entity,
    entityType,
    enabled: shouldLoad && (entityType === "citoyens" || entityType === "organizations"),
    indexStep: 1,
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

  // Get counts
  const friendsCount = friendsQuery.totalCount || friendsQuery.friends.length;
  const organizationsCount = organizationsQuery.totalCount || organizationsQuery.organizations.length;
  const projectsCount = projectsQuery.totalCount || projectsQuery.projects.length;

  const getTabsForEntityType = () => {
    switch (entityType) {
      case "citoyens":
        return [
          { id: "citoyensamis", label: t("CommunitiesTab.friends"), show: true, component: "friends", count: friendsCount },
          { id: "citoyensorganisations", label: t("CommunitiesTab.organizations"), show: true, component: "organizations", count: organizationsCount },
          { id: "citoyensabonnements", label: t("CommunitiesTab.subscriptions"), show: true, component: "subscriptions", count: 0 },
          { id: "citoyensabonnés", label: t("CommunitiesTab.subscribers"), show: true, component: "subscribers", count: 0 },
        ];
      case "projects":
        return [
          { id: "contributeurs", label: t("CommunitiesTab.contributors"), show: true, component: "contributors", count: 0 },
          { id: "tovalidated", label: t("CommunitiesTab.contributorsToValidate"), show: canEdit, component: "placeholder", count: 0 },
          { id: "contributeursabonnés", label: t("CommunitiesTab.subscribers"), show: true, component: "subscribers", count: 0 },
        ];
      case "organizations":
        return [
          { id: "membres", label: t("CommunitiesTab.members"), show: true, component: "members", count: 0 },
          { id: "tovalidated", label: t("CommunitiesTab.membersToValidate"), show: canEdit, component: "placeholder", count: 0 },
          { id: "membresabonnés", label: t("CommunitiesTab.subscribers"), show: true, component: "subscribers", count: 0 },
          { id: "projets", label: t("CommunitiesTab.projects"), show: true, component: "projects", count: projectsCount },
        ];
      default:
        return [];
    }
  };

  const tabs = getTabsForEntityType().filter(tab => tab.show);
  const defaultTab = tabs[0]?.id || "";

  if (activeSubTab === null && defaultTab) {
    setActiveSubTab(defaultTab);
  }

  if (tabs.length === 0) {
    return (
      <div className="bg-background p-6 sm:p-8 rounded-lg border border-border shadow-sm">
        <div className="text-center py-12 sm:py-16">
          <div className="text-muted-foreground mb-3 sm:mb-4">
            <Users className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 mx-auto" />
          </div>
          <p className="text-lg sm:text-xl font-semibold text-foreground mb-1 sm:mb-2 px-4">
            {t("CommunitiesTab.noCommunities")}
          </p>
          <p className="text-sm sm:text-base text-muted-foreground px-4">
            {t("CommunitiesTab.noCommunitiesDescription")}
          </p>
        </div>
      </div>
    );
  }

  const renderTabContent = (tab: { id: string; label: string; component: string }) => {
    const isActive = activeSubTab === tab.id;

    switch (tab.component) {
      case "friends":
        return <FriendsTab enabled={isActive} />;
      case "organizations":
        return <OrganizationsTab enabled={isActive} />;
      case "subscriptions":
        return <SubscriptionsTab enabled={isActive} />;
      case "subscribers":
        return <SubscribersTab enabled={isActive} />;
      case "contributors":
        return <ContributorsTab enabled={isActive} />;
      case "members":
        return <MembersTab enabled={isActive} />;
      case "projects":
        return <ProjectsTab enabled={isActive} />;
      case "placeholder":
      default:
        return (
          <div className="bg-background p-6 sm:p-8 rounded-lg border border-border shadow-sm">
            <div className="text-center py-12 sm:py-16">
              <div className="text-muted-foreground mb-3 sm:mb-4">
                <Users className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 mx-auto" />
              </div>
              <p className="text-lg sm:text-xl font-semibold text-foreground mb-1 sm:mb-2 px-4">
                {t("CommunitiesTab.comingSoon")}
              </p>
              <p className="text-sm sm:text-base text-muted-foreground px-4">
                {tab.label} - {t("CommunitiesTab.comingSoonDescription")}
              </p>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <Tabs
        defaultValue={defaultTab}
        value={activeSubTab || defaultTab}
        onValueChange={setActiveSubTab}
        className="w-full"
      >
        <TabsList className="w-full justify-start overflow-x-auto">
          {tabs.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id} className="gap-2">
              {tab.label}
              {tab.count > 0 && (
                <Badge
                  variant={activeSubTab === tab.id ? "secondary" : "outline"}
                  className="text-xs px-1.5 py-0 h-5 min-w-5 justify-center"
                >
                  {tab.count}
                </Badge>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        {tabs.map((tab) => (
          <TabsContent key={tab.id} value={tab.id}>
            {renderTabContent(tab)}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
