import { useState } from "react";
import { useT } from "@/hooks/useT";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Users, UserPlus, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ContributorSection as ContributorSectionType } from "@/types/site-schema";
import type { Project, User, Organization } from "@communecter/cocolight-api-client";
import { MemberListRenderer } from "@/modules/profil/components/members/MemberListRenderer";
import { MemberManagementDialog } from "@/modules/profil/components/members/MemberManagementDialog";
import { InviteMemberDialog } from "@/modules/profil/components/members/InviteMemberDialog";
import { useProfilPermissions } from "@/modules/profil/hooks/useProfilPermissions";
import { useEntityLabels } from "@/modules/profil/hooks/useEntityLabels";
import { useQuery, useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { isProject } from "@/lib/getTypedEntity";
import { useCocolight } from "@/hooks/useCocolight";

interface ContributorSectionProps {
  id?: string;
  props: ContributorSectionType["props"];
}

export default function ContributorSection({ id, props }: ContributorSectionProps) {
  const t = useT("modules/profil");
  const queryClient = useQueryClient();

  const { me, api } = useCocolight();
  const [selectedTab, setSelectedTab] = useState("all");
  const [showManagement, setShowManagement] = useState(false);
  const [showInvite, setShowInvite] = useState(false);

  const refreshContributors = () => {
    queryClient.invalidateQueries({ queryKey: ["project-contributors", props.projectId] });
  };
  const { data: project, error: projectError } = useQuery({
    queryKey: ["project", props.projectId, me?.id],
    queryFn: async () => {
      if (me?.isConnected) {
        const projectEntity = await me.project({ id: props.projectId });
        if (!projectEntity || !isProject(projectEntity)) {
          throw new Error("L'entité n'est pas un projet");
        }
        return projectEntity as Project;
      } else {
        if (!api) throw new Error("API non initialisée");

        const projectEntity = await api.project({ id: props.projectId });
        if (!projectEntity || !isProject(projectEntity)) {
          throw new Error("L'entité n'est pas un projet");
        }
        return projectEntity as Project;
      }
    },
    enabled: !!props.projectId && (!!me?.isConnected || !!api),
  });
  const permissions = useProfilPermissions(project || null);
  const labels = useEntityLabels(project || null);
  const {
    data: allContributorsData,
    fetchNextPage: fetchNextAll,
    hasNextPage: hasNextAll,
    isFetchingNextPage: isFetchingNextAll,
    isLoading: isLoadingAll,
  } = useInfiniteQuery({
    queryKey: ["project-contributors", props.projectId, "all"],
    queryFn: async ({ pageParam = 0 }) => {
      if (!project) return { results: [], totalCount: 0 };

      const result = await project.getContributors(
        { indexMin: pageParam, indexStep: 20 },
        { toBeValidated: false }
      );

      return {
        results: result.results || [],
        totalCount: result.count?.total || 0,
        nextPage: pageParam + 20,
      };
    },
    getNextPageParam: (lastPage, pages) => {
      const totalFetched = pages.reduce((sum, page) => sum + page.results.length, 0);
      return totalFetched < lastPage.totalCount ? lastPage.nextPage : undefined;
    },
    enabled: !!project,
    initialPageParam: 0,
  });

  const {
    data: pendingContributorsData,
    fetchNextPage: fetchNextPending,
    hasNextPage: hasNextPending,
    isFetchingNextPage: isFetchingNextPending,
    isLoading: isLoadingPending,
  } = useInfiniteQuery({
    queryKey: ["project-contributors", props.projectId, "pending"],
    queryFn: async ({ pageParam = 0 }) => {
      if (!project) return { results: [], totalCount: 0 };

      const result = await project.getContributors(
        { indexMin: pageParam, indexStep: 20 },
        { toBeValidated: true }
      );

      return {
        results: result.results || [],
        totalCount: result.count?.total || 0,
        nextPage: pageParam + 20,
      };
    },
    getNextPageParam: (lastPage, pages) => {
      const totalFetched = pages.reduce((sum, page) => sum + page.results.length, 0);
      return totalFetched < lastPage.totalCount ? lastPage.nextPage : undefined;
    },
    enabled: !!project,
    initialPageParam: 0,
  });

  const {
    data: adminContributorsData,
    fetchNextPage: fetchNextAdmin,
    hasNextPage: hasNextAdmin,
    isFetchingNextPage: isFetchingNextAdmin,
    isLoading: isLoadingAdmin,
  } = useInfiniteQuery({
    queryKey: ["project-contributors", props.projectId, "admin"],
    queryFn: async ({ pageParam = 0 }) => {
      if (!project) return { results: [], totalCount: 0 };

      const result = await project.getContributors(
        { indexMin: pageParam, indexStep: 20 },
        { isAdmin: true }
      );

      return {
        results: result.results || [],
        totalCount: result.count?.total || 0,
        nextPage: pageParam + 20,
      };
    },
    getNextPageParam: (lastPage, pages) => {
      const totalFetched = pages.reduce((sum, page) => sum + page.results.length, 0);
      return totalFetched < lastPage.totalCount ? lastPage.nextPage : undefined;
    },
    enabled: !!project,
    initialPageParam: 0,
  });

  const createObserver = (fetchNext: () => void, hasNext: boolean) => {
    return (node: HTMLElement | null) => {
      if (!node || !hasNext) return;

      const observer = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting && hasNext) {
            fetchNext();
          }
        },
        { threshold: 0.1 }
      );

      observer.observe(node);
      return () => observer.disconnect();
    };
  };

  const allMembers = allContributorsData?.pages.flatMap((page) => page.results) || [];
  const pendingMembers = pendingContributorsData?.pages.flatMap((page) => page.results) || [];
  const adminMembers = adminContributorsData?.pages.flatMap((page) => page.results) || [];

  const allTotalCount = allContributorsData?.pages[0]?.totalCount || 0;
  const pendingTotalCount = pendingContributorsData?.pages[0]?.totalCount || 0;
  const adminTotalCount = adminContributorsData?.pages[0]?.totalCount || 0;

  if (projectError) {
    return (
      <Card id={id}>
        <CardContent className="p-8">
          <div className="text-center text-destructive">
            Erreur lors du chargement du projet: {projectError.message}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!project) {
    return (
      <Card id={id}>
        <CardContent className="p-8">
          <div className="text-center text-muted-foreground">
            {t("ProfileMembers.loadingProject")}
          </div>
        </CardContent>
      </Card>
    );
  }

  const title = props.title
    ? typeof props.title === "string"
      ? props.title
      : props.title.fr || props.title.en || "Contributeurs"
    : labels.title;

  const headerContent = (
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center space-x-2">
        <Users className="h-5 w-5" />
        <span className="text-xl font-semibold">{title}</span>
      </div>
      {permissions.isAdmin && (
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowInvite(true)}
            disabled={!permissions.canEditProfile}
          >
            <UserPlus className="h-4 w-4 sm:mr-1" />
            <span className="hidden sm:inline">{labels.invite}</span>
          </Button>
          {props.showManagement && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowManagement(true)}
              disabled={!permissions.canEditProfile}
            >
              <Settings className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">{t("ProfileMembers.manage")}</span>
            </Button>
          )}
        </div>
      )}
    </div>
  );

  // Contenu des tabs
  const tabsContent = (
    <Tabs value={selectedTab} onValueChange={setSelectedTab}>
      <TabsList className={cn(
        "grid w-full",
        permissions.isAdmin ? "grid-cols-3" : "grid-cols-2"
      )}>
        <TabsTrigger value="all" className={cn("text-xs sm:text-sm")}>
          {labels.members} ({allTotalCount})
        </TabsTrigger>
        {permissions.isAdmin && (
          <TabsTrigger value="pending" className={cn("text-xs sm:text-sm")}>
            {labels.pending} ({pendingTotalCount})
          </TabsTrigger>
        )}
        <TabsTrigger value="admins" className={cn("text-xs sm:text-sm")}>
          {labels.admin}s ({adminTotalCount})
        </TabsTrigger>
      </TabsList>

      <TabsContent value="all" className="mt-4">
        <MemberListRenderer
          members={allMembers as (User | Organization)[]}
          entity={project}
          isLoading={isLoadingAll}
          showActions={false}
          showBadges={props.showRole}
          isPending={false}
          lastItemRef={createObserver(() => fetchNextAll(), !!hasNextAll)}
          isFetchingNextPage={isFetchingNextAll}
        />
      </TabsContent>

      {permissions.isAdmin && (
        <TabsContent value="pending" className="mt-4">
          <MemberListRenderer
            members={pendingMembers as (User | Organization)[]}
            entity={project}
            isLoading={isLoadingPending}
            showActions={false}
            showBadges={props.showRole}
            isPending={true}
            lastItemRef={createObserver(() => fetchNextPending(), !!hasNextPending)}
            isFetchingNextPage={isFetchingNextPending}
          />
        </TabsContent>
      )}

      <TabsContent value="admins" className="mt-4">
        <MemberListRenderer
          members={adminMembers as (User | Organization)[]}
          entity={project}
          isLoading={isLoadingAdmin}
          showActions={false}
          showBadges={props.showRole}
          isPending={false}
          lastItemRef={createObserver(() => fetchNextAdmin(), !!hasNextAdmin)}
          isFetchingNextPage={isFetchingNextAdmin}
        />
      </TabsContent>
    </Tabs>
  );

  // Dialogs avec rafraîchissement après fermeture
  const dialogs = (
    <>
      {showManagement && (
        <MemberManagementDialog
          entity={project}
          open={showManagement}
          onOpenChange={(open) => {
            setShowManagement(open);
            if (!open) {
              // Rafraîchir la liste quand le dialogue se ferme
              refreshContributors();
            }
          }}
        />
      )}

      {showInvite && (
        <InviteMemberDialog
          entity={project}
          open={showInvite}
          onOpenChange={(open) => {
            setShowInvite(open);
            if (!open) {
              // Rafraîchir la liste quand le dialogue se ferme
              refreshContributors();
            }
          }}
        />
      )}
    </>
  );

  // Rendu avec ou sans Card selon la config
  if (props.showCard === false) {
    return (
      <div id={id}>
        {headerContent}
        {tabsContent}
        {dialogs}
      </div>
    );
  }

  return (
    <Card id={id}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <Users className="h-5 w-5" />
            <span>{title}</span>
          </CardTitle>
          {permissions.isAdmin && (
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowInvite(true)}
                disabled={!permissions.canEditProfile}
              >
                <UserPlus className="h-4 w-4 sm:mr-1" />
                <span className="hidden sm:inline">{labels.invite}</span>
              </Button>
              {props.showManagement && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowManagement(true)}
                  disabled={!permissions.canEditProfile}
                >
                  <Settings className="h-4 w-4 sm:mr-1" />
                  <span className="hidden sm:inline">{t("ProfileMembers.manage")}</span>
                </Button>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {tabsContent}
      </CardContent>
      {dialogs}
    </Card>
  );
}
