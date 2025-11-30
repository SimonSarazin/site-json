import { useState } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { Search, Building2, Briefcase, MapPin, Calendar, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useT } from "@/hooks/useT";
import { useProfileEntity } from "../../hooks/useProfileEntity";
import { useUserOrganizations, useUserProjects, useUserPois, useUserEvents } from "../../hooks/useMembershipQuery";
import { useCocolight } from "@/hooks/useCocolight";
import type { CollectionKey } from "@communecter/cocolight-api-client";
import { EntityCard, getEntityIcon } from "../shared/EntityCard";
import { EntityGrid } from "../shared/EntityGrid";
import { EntityEmptyState } from "../shared/EntityEmptyState";

export function MembershipTab() {
  const { entity } = useProfileEntity();
  const { me } = useCocolight();
  const t = useT("modules/profil");
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("organizations");
  const debouncedSearch = useDebounce(searchTerm, 300);

  // Queries avec infinite scroll
  const {
    organizations,
    totalCount: organizationsCount,
    isLoading: organizationsLoading,
    isFetchingNextPage: organizationsFetching,
    lastItemRef: organizationsLastRef,
    hasNextPage: organizationsHasNext
  } = useUserOrganizations(entity, {
    search: debouncedSearch,
    indexStep: 20
  });

  const {
    projects,
    totalCount: projectsCount,
    isLoading: projectsLoading,
    isFetchingNextPage: projectsFetching,
    lastItemRef: projectsLastRef,
    hasNextPage: projectsHasNext
  } = useUserProjects(entity, {
    search: debouncedSearch,
    indexStep: 20
  });

  const {
    pois,
    totalCount: poisCount,
    isLoading: poisLoading,
    isFetchingNextPage: poisFetching,
    lastItemRef: poisLastRef,
    hasNextPage: poisHasNext
  } = useUserPois(entity, {
    search: debouncedSearch,
    indexStep: 20
  });

  const {
    events,
    totalCount: eventsCount,
    isLoading: eventsLoading,
    isFetchingNextPage: eventsFetching,
    lastItemRef: eventsLastRef,
    hasNextPage: eventsHasNext
  } = useUserEvents(entity, {
    search: debouncedSearch,
    indexStep: 20
  });

  const isOwnProfile = me?.slug === entity?.slug;

  if (!isOwnProfile) {
    return (
      <div className="bg-card p-8 rounded-lg border border-border shadow-sm">
        <div className="text-center py-16">
          <div className="text-gray-400 mb-4">
            <Building2 className="w-16 h-16 mx-auto" />
          </div>
          <p className="text-xl font-semibold text-foreground mb-2">{t("MembershipTab.privateProfile")}</p>
          <p className="text-muted-foreground">{t("MembershipTab.cannotViewMemberships")}</p>
        </div>
      </div>
    );
  }

  const getEmptyStateAction = (type: CollectionKey) => {
    const actionLabels: Partial<Record<CollectionKey, string>> = {
      organizations: t("MembershipTab.joinOrganization"),
      projects: t("MembershipTab.joinProject"),
      poi: t("MembershipTab.addPoi"),
      events: t("MembershipTab.createEvent"),
    };

    return {
      label: actionLabels[type] || type,
      onClick: () => {
        // TODO: Implémenter l'action
        console.log(`Action for ${type}`);
      },
      icon: <Plus className="w-4 h-4 mr-2" />,
    };
  };

  const renderEmptyState = (type: CollectionKey, emptyMessage: string) => (
    <EntityEmptyState
      icon={getEntityIcon(type)}
      title={emptyMessage}
      description={searchTerm ? t("MembershipTab.tryDifferentSearch") : t("MembershipTab.startJoining")}
      action={getEmptyStateAction(type)}
    />
  );

  const renderTabContent = (
    items: any[],
    loading: boolean,
    isFetchingNext: boolean,
    hasNext: boolean,
    lastItemRef: (node: HTMLElement | null) => void,
    type: CollectionKey,
    emptyMessage: string
  ) => (
    <EntityGrid
      items={items}
      isLoading={loading}
      isFetchingNext={isFetchingNext}
      hasNextPage={hasNext}
      lastItemRef={lastItemRef}
      columns={{ sm: 1, md: 1, lg: 1, xl: 1 }}
      renderItem={(item, _index, isLast, ref) => (
        <EntityCard
          key={item.id || item.slug}
          entity={item}
          showRole={true}
          lastItemRef={isLast && hasNext ? ref : undefined}
        />
      )}
      emptyState={renderEmptyState(type, emptyMessage)}
    />
  );

  return (
    <div className="space-y-6">
      {/* Header avec recherche */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder={t("MembershipTab.searchMemberships")}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Onglets */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="organizations" className="flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            <span className="hidden sm:inline">{t("MembershipTab.tabs.organizations")}</span>
            <span className="sm:hidden">{t("MembershipTab.tabs.orgsShort")}</span>
            {organizationsCount > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs px-1.5 py-0.5">
                {organizationsCount}
              </Badge>
            )}
          </TabsTrigger>

          <TabsTrigger value="projects" className="flex items-center gap-2">
            <Briefcase className="w-4 h-4" />
            <span className="hidden sm:inline">{t("MembershipTab.tabs.projects")}</span>
            <span className="sm:hidden">{t("MembershipTab.tabs.projectsShort")}</span>
            {projectsCount > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs px-1.5 py-0.5">
                {projectsCount}
              </Badge>
            )}
          </TabsTrigger>

          <TabsTrigger value="pois" className="flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            <span className="hidden sm:inline">{t("MembershipTab.tabs.pois")}</span>
            <span className="sm:hidden">{t("MembershipTab.tabs.poisShort")}</span>
            {poisCount > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs px-1.5 py-0.5">
                {poisCount}
              </Badge>
            )}
          </TabsTrigger>

          <TabsTrigger value="events" className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            <span className="hidden sm:inline">{t("MembershipTab.tabs.events")}</span>
            <span className="sm:hidden">{t("MembershipTab.tabs.eventsShort")}</span>
            {eventsCount > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs px-1.5 py-0.5">
                {eventsCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="organizations">
          {renderTabContent(
            organizations,
            organizationsLoading,
            organizationsFetching,
            !!organizationsHasNext,
            organizationsLastRef,
            "organizations",
            t("MembershipTab.noOrganizations")
          )}
        </TabsContent>

        <TabsContent value="projects">
          {renderTabContent(
            projects,
            projectsLoading,
            projectsFetching,
            !!projectsHasNext,
            projectsLastRef,
            "projects",
            t("MembershipTab.noProjects")
          )}
        </TabsContent>

        <TabsContent value="pois">
          {renderTabContent(
            pois,
            poisLoading,
            poisFetching,
            !!poisHasNext,
            poisLastRef,
            "poi",
            t("MembershipTab.noPois")
          )}
        </TabsContent>

        <TabsContent value="events">
          {renderTabContent(
            events,
            eventsLoading,
            eventsFetching,
            !!eventsHasNext,
            eventsLastRef,
            "events",
            t("MembershipTab.noEvents")
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
