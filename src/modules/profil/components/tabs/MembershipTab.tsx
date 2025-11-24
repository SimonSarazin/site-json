import { useState } from "react";
import { Search, Building2, Briefcase, MapPin, Calendar, Plus, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useT } from "@/hooks/useT";
import { useProfileEntity } from "../../hooks/useProfileEntity";
import { useUserOrganizations, useUserProjects, useUserPois, useUserEvents } from "../../hooks/useMembershipQuery";
import { useCocolight } from "@/hooks/useCocolight";
import { Link } from "react-router";

export function MembershipTab() {
  const { entity } = useProfileEntity();
  const { me } = useCocolight();
  const t = useT("modules/profil");
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("organizations");

  // Queries avec infinite scroll
  const {
    organizations,
    totalCount: organizationsCount,
    isLoading: organizationsLoading,
    isFetchingNextPage: organizationsFetching,
    lastItemRef: organizationsLastRef,
    hasNextPage: organizationsHasNext
  } = useUserOrganizations(entity, {
    search: searchTerm,
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
    search: searchTerm,
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
    search: searchTerm,
    indexStep: 20
  });

  const {
    events,
    totalCount: eventsCount,
    isLoading: eventsLoading,
    isFetchingNextPage: eventsFetching,
    lastItemRef: eventsLastRef,
    hasNextPage: eventsHasNext
  } = useUserEvents();

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

  const renderEntityCard = (entity: any, type: "organization" | "project" | "poi" | "event", _index: number, lastItemRef?: any) => {
    const getIcon = () => {
      switch (type) {
        case "organization": return <Building2 className="w-5 h-5 text-teal-600" />;
        case "project": return <Briefcase className="w-5 h-5 text-blue-600" />;
        case "poi": return <MapPin className="w-5 h-5 text-green-600" />;
        case "event": return <Calendar className="w-5 h-5 text-orange-600" />;
      }
    };

    const getTypeLabel = () => {
      switch (type) {
        case "organization": return t("MembershipTab.organization");
        case "project": return t("MembershipTab.project");
        case "poi": return t("MembershipTab.poi");
        case "event": return t("MembershipTab.event");
      }
    };

    return (
      <div
        key={entity.id}
        ref={lastItemRef}
        className="bg-card border border-border rounded-lg p-4 hover:shadow-md transition-shadow"
      >
        <div className="flex items-start gap-4">
          {/* Image/Logo */}
          <div className="w-16 h-16 rounded-lg border border-border overflow-hidden bg-muted flex-shrink-0">
            {entity.serverData?.profilImageUrl ? (
              <img
                src={entity.serverData.profilImageUrl}
                alt={entity.serverData?.name || ""}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                {getIcon()}
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-semibold text-foreground truncate">
                    {entity.serverData?.name || t("common.untitled")}
                  </h3>
                  <Badge variant="secondary" className="text-xs">
                    {getTypeLabel()}
                  </Badge>
                </div>

                {entity.serverData?.shortDescription && (
                  <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                    {entity.serverData.shortDescription}
                  </p>
                )}

                {/* Localisation */}
                {entity.serverData?.address?.addressLocality && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
                    <MapPin className="w-3 h-3" />
                    <span>
                      {entity.serverData.address.addressLocality}
                      {entity.serverData.address.postalCode &&
                        `, ${entity.serverData.address.postalCode}`}
                    </span>
                  </div>
                )}

                {/* Date pour les événements */}
                {type === "event" && entity.serverData?.startDate && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
                    <Calendar className="w-3 h-3" />
                    <span>{new Date(entity.serverData.startDate).toLocaleDateString()}</span>
                  </div>
                )}

                {/* Rôle de l'utilisateur */}
                <div className="flex items-center gap-2 text-xs">
                  {/* Admin badge - seulement pour organizations, projects, events */}
                  {type !== "poi" && entity.isAdmin?.() && (
                    <Badge variant="outline" className="text-teal-600 border-teal-600">
                      {t("MembershipTab.admin")}
                    </Badge>
                  )}

                  {/* Badges spécifiques selon le type d'entité */}
                  {type === "organization" && entity.isMember?.() && (
                    <Badge variant="outline">
                      {t("MembershipTab.member")}
                    </Badge>
                  )}
                  {type === "project" && entity.isContributor?.() && (
                    <Badge variant="outline">
                      {t("MembershipTab.contributor")}
                    </Badge>
                  )}
                  {type === "event" && entity.isAttendee?.() && (
                    <Badge variant="outline">
                      {t("MembershipTab.participant")}
                    </Badge>
                  )}
                  {type === "poi" && entity.isAuthor?.() && (
                    <Badge variant="outline">
                      {t("MembershipTab.author")}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 ml-4">
                <Button variant="outline" size="sm" asChild>
                  <Link to={`/profil/${entity.slug}`}>
                    <ExternalLink className="w-4 h-4" />
                    <span className="hidden sm:inline ml-1">{t("common.viewProfile")}</span>
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderTabContent = (
    items: any[],
    loading: boolean,
    isFetchingNext: boolean,
    hasNext: boolean,
    lastItemRef: any,
    type: "organization" | "project" | "poi" | "event",
    emptyMessage: string
  ) => (
    <div className="space-y-4">
      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600 mx-auto"></div>
          <p className="text-muted-foreground mt-2">{t("common.loading")}</p>
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-gray-400 mb-4">
            {type === "organization" && <Building2 className="w-12 h-12 mx-auto" />}
            {type === "project" && <Briefcase className="w-12 h-12 mx-auto" />}
            {type === "poi" && <MapPin className="w-12 h-12 mx-auto" />}
            {type === "event" && <Calendar className="w-12 h-12 mx-auto" />}
          </div>
          <p className="text-foreground font-medium mb-2">{emptyMessage}</p>
          <p className="text-muted-foreground text-sm mb-4">
            {searchTerm ? t("MembershipTab.tryDifferentSearch") : t("MembershipTab.startJoining")}
          </p>
          <Button className="bg-teal-600 hover:bg-teal-700">
            <Plus className="w-4 h-4 mr-2" />
            {type === "organization" && t("MembershipTab.joinOrganization")}
            {type === "project" && t("MembershipTab.joinProject")}
            {type === "poi" && t("MembershipTab.addPoi")}
            {type === "event" && t("MembershipTab.createEvent")}
          </Button>
        </div>
      ) : (
        <div className="grid gap-4">
          {items.map((item, index) => {
            const isLast = index === items.length - 1;
            return renderEntityCard(
              item,
              type,
              index,
              isLast && hasNext ? lastItemRef : undefined
            );
          })}
          {isFetchingNext && (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-teal-600 mx-auto"></div>
              <p className="text-muted-foreground text-sm mt-2">{t("common.loading")}</p>
            </div>
          )}
        </div>
      )}
    </div>
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
            "organization",
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
            "project",
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
            "event",
            t("MembershipTab.noEvents")
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}