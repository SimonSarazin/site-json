import { useState } from "react";
import { useT } from "@/hooks/useT";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Users, UserPlus, Settings, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MemberSection as MemberSectionType } from "@/types/site-schema";
import type { Organization, Project, User } from "@communecter/cocolight-api-client";
import { MemberListRenderer } from "@/modules/profil/components/members/MemberListRenderer";
import { MemberManagementDialog } from "@/modules/profil/components/members/MemberManagementDialog";
import { InviteMemberDialog } from "@/modules/profil/components/members/InviteMemberDialog";
import { useProfilPermissions } from "@/modules/profil/hooks/useProfilPermissions";
import { useEntityLabels } from "@/modules/profil/hooks/useEntityLabels";
import { useOrganizationMembers, useProjectContributors } from "@/modules/profil/hooks/useMembersQuery";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { isOrganization, isProject } from "@/lib/getTypedEntity";
import { useCocolight } from "@/hooks/useCocolight";
import CardProfile from "@/modules/search/components/card/CardProfile";
import { SwitchDetailsMode } from "@/modules/search/components/SwitchDetailsMode";

interface MemberSectionProps {
  id?: string;
  props: MemberSectionType["props"];
}

function ProfileCardListRenderer({
  members,
  isLoading,
  isFetchingNextPage,
  showBadges,
  isPending,
  cardConfig,
  lastItemRef,
}: {
  members: (User | Organization)[];
  isLoading?: boolean;
  isFetchingNextPage?: boolean;
  showBadges?: boolean;
  isPending?: boolean;
  cardConfig?: MemberSectionType["props"]["card"];
  lastItemRef?: (node: HTMLElement | null) => void;
}) {
  const [openDetails, setOpenDetails] = useState(false);
  const [selectedItem, setSelectedItem] = useState<User | Organization | null>(null);

  const detailsMode = cardConfig?.detailsMode || "link";

  const handleOpenDetails = (member: User | Organization) => {
    if (detailsMode === "link") {
      return;
    }
    setSelectedItem(member);
    setOpenDetails(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (members.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Aucun membre trouvé
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {members.map((member, index) => {
          const isLastItem = index === members.length - 1;

          const cardElement = (
            <CardProfile
              key={member.id || index}
              item={member}
              index={index}
              showBadges={showBadges}
              isPending={isPending}
              card={{
                showDescription: cardConfig?.showDescription,
                showAddress: cardConfig?.showAddress,
                detailsMode: detailsMode === "link" ? "link" : undefined,
              }}
              onClick={detailsMode !== "link" ? () => handleOpenDetails(member) : undefined}
            />
          );

          if (isLastItem && lastItemRef) {
            return (
              <div key={member.id || index} ref={lastItemRef as (node: HTMLDivElement | null) => void}>
                {cardElement}
              </div>
            );
          }

          return cardElement;
        })}
      </div>

      {isFetchingNextPage && (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="ml-2 text-sm text-muted-foreground">Chargement...</span>
        </div>
      )}

      {selectedItem && detailsMode !== "link" && (
        <SwitchDetailsMode
          openDetails={openDetails}
          setOpenDetails={setOpenDetails}
          item={selectedItem as any}
          card={{ detailsMode: detailsMode === "drawer" ? "drawer" : "dialog" }}
        />
      )}
    </div>
  );
}

export default function MemberSection({ id, props }: MemberSectionProps) {
  const t = useT("modules/profil");
  const queryClient = useQueryClient();

  const { me, api } = useCocolight();
  const [selectedTab, setSelectedTab] = useState("all");
  const [showManagement, setShowManagement] = useState(false);
  const [showInvite, setShowInvite] = useState(false);

  const entityType = props.projectId ? "project" : "organization";
  const entityId = props.projectId || props.organizationId;

  const refreshMembers = () => {
    if (entityType === "project") {
      queryClient.invalidateQueries({ queryKey: ["project-contributors", entityId] });
    } else {
      queryClient.invalidateQueries({ queryKey: ["organization-members", entityId] });
    }
  };

  const canFetch = !!entityId && (me?.isConnected || !!api);

  const { data: entity, error: entityError, isLoading: isEntityLoading } = useQuery({
    queryKey: [entityType, entityId, me?.id],
    queryFn: async () => {
      if (entityType === "project") {
        if (me?.isConnected) {
          const projectEntity = await me.project({ id: entityId! });
          if (!projectEntity || !isProject(projectEntity)) {
            throw new Error("L'entité n'est pas un projet");
          }
          return projectEntity as Project;
        } else {
          if (!api) throw new Error("API non initialisée");
          const projectEntity = await api.project({ id: entityId! });
          if (!projectEntity || !isProject(projectEntity)) {
            throw new Error("L'entité n'est pas un projet");
          }
          return projectEntity as Project;
        }
      } else {
        if (me?.isConnected) {
          const orgEntity = await me.organization({ id: entityId! });
          if (!orgEntity || !isOrganization(orgEntity)) {
            throw new Error("L'entité n'est pas une organisation");
          }
          return orgEntity as Organization;
        } else {
          if (!api) throw new Error("API non initialisée");
          const orgEntity = await api.organization({ id: entityId! });
          if (!orgEntity || !isOrganization(orgEntity)) {
            throw new Error("L'entité n'est pas une organisation");
          }
          return orgEntity as Organization;
        }
      }
    },
    enabled: canFetch,
  });

  const permissions = useProfilPermissions(entity || null);
  const labels = useEntityLabels(entity || null);

  const orgEntity = entityType === "organization" && entity ? (entity as Organization) : null;
  const projectEntity = entityType === "project" && entity ? (entity as Project) : null;

  const orgMembers = useOrganizationMembers(orgEntity, { toBeValidated: false });
  const orgPendingMembers = useOrganizationMembers(orgEntity, { toBeValidated: true });
  const orgAdminMembers = useOrganizationMembers(orgEntity, { isAdmin: true });

  const projectContributors = useProjectContributors(projectEntity, { toBeValidated: false });
  const projectPendingContributors = useProjectContributors(projectEntity, { toBeValidated: true });
  const projectAdminContributors = useProjectContributors(projectEntity, { isAdmin: true });

  const allMembers = entityType === "project"
    ? {
        members: projectContributors.contributors || [],
        totalCount: projectContributors.totalCount || 0,
        isLoading: projectContributors.isLoading,
        isFetchingNextPage: projectContributors.isFetchingNextPage,
        lastItemRef: projectContributors.lastItemRef,
      }
    : {
        members: orgMembers.members || [],
        totalCount: orgMembers.totalCount || 0,
        isLoading: orgMembers.isLoading,
        isFetchingNextPage: orgMembers.isFetchingNextPage,
        lastItemRef: orgMembers.lastItemRef,
      };
  const pendingMembers = entityType === "project"
    ? {
        members: projectPendingContributors.contributors || [],
        totalCount: projectPendingContributors.totalCount || 0,
        isLoading: projectPendingContributors.isLoading,
        isFetchingNextPage: projectPendingContributors.isFetchingNextPage,
        lastItemRef: projectPendingContributors.lastItemRef,
      }
    : {
        members: orgPendingMembers.members || [],
        totalCount: orgPendingMembers.totalCount || 0,
        isLoading: orgPendingMembers.isLoading,
        isFetchingNextPage: orgPendingMembers.isFetchingNextPage,
        lastItemRef: orgPendingMembers.lastItemRef,
      };
  const adminMembers = entityType === "project"
    ? {
        members: projectAdminContributors.contributors || [],
        totalCount: projectAdminContributors.totalCount || 0,
        isLoading: projectAdminContributors.isLoading,
        isFetchingNextPage: projectAdminContributors.isFetchingNextPage,
        lastItemRef: projectAdminContributors.lastItemRef,
      }
    : {
        members: orgAdminMembers.members || [],
        totalCount: orgAdminMembers.totalCount || 0,
        isLoading: orgAdminMembers.isLoading,
        isFetchingNextPage: orgAdminMembers.isFetchingNextPage,
        lastItemRef: orgAdminMembers.lastItemRef,
      };

  const cardType = props.card?.type || "default";
  const useProfileCard = cardType === "profile";

  if (entityError) {
    return (
      <Card id={id}>
        <CardContent className="p-8">
          <div className="text-center text-destructive">
            Erreur lors du chargement: {entityError.message}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!entity || isEntityLoading) {
    return (
      <Card id={id}>
        <CardContent className="p-8">
          <div className="flex flex-col items-center justify-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <div className="text-center text-muted-foreground">
              {entityType === "project"
                ? t("ProfileMembers.loadingProject")
                : t("ProfileMembers.loadingOrganization")}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const title = props.title
    ? typeof props.title === "string"
      ? props.title
      : props.title.fr || props.title.en || (entityType === "project" ? "Contributeurs" : "Membres")
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

  const renderMemberList = (
    members: (User | Organization)[],
    isLoading: boolean,
    isFetchingNextPage: boolean,
    isPending: boolean,
    lastItemRef: (node: HTMLElement | null) => void
  ) => {
    if (useProfileCard) {
      return (
        <ProfileCardListRenderer
          members={members}
          isLoading={isLoading}
          isFetchingNextPage={isFetchingNextPage}
          showBadges={props.showRole}
          isPending={isPending}
          cardConfig={props.card}
          lastItemRef={lastItemRef}
        />
      );
    }

    return (
      <MemberListRenderer
        members={members}
        entity={entity}
        isLoading={isLoading}
        showActions={false}
        showBadges={props.showRole}
        isPending={isPending}
        lastItemRef={lastItemRef}
        isFetchingNextPage={isFetchingNextPage}
      />
    );
  };

  const tabsContent = (
    <Tabs value={selectedTab} onValueChange={setSelectedTab}>
      <TabsList className={cn(
        "grid w-full",
        permissions.isAdmin ? "grid-cols-3" : "grid-cols-2"
      )}>
        <TabsTrigger value="all" className={cn("text-xs sm:text-sm")}>
          {labels.members} ({allMembers.totalCount})
        </TabsTrigger>
        {permissions.isAdmin && (
          <TabsTrigger value="pending" className={cn("text-xs sm:text-sm")}>
            {labels.pending} ({pendingMembers.totalCount})
          </TabsTrigger>
        )}
        <TabsTrigger value="admins" className={cn("text-xs sm:text-sm")}>
          {labels.admin}s ({adminMembers.totalCount})
        </TabsTrigger>
      </TabsList>

      <TabsContent value="all" className="mt-4">
        {renderMemberList(
          allMembers.members as (User | Organization)[],
          allMembers.isLoading,
          allMembers.isFetchingNextPage,
          false,
          allMembers.lastItemRef
        )}
      </TabsContent>

      {permissions.isAdmin && (
        <TabsContent value="pending" className="mt-4">
          {renderMemberList(
            pendingMembers.members as (User | Organization)[],
            pendingMembers.isLoading,
            pendingMembers.isFetchingNextPage,
            true,
            pendingMembers.lastItemRef
          )}
        </TabsContent>
      )}

      <TabsContent value="admins" className="mt-4">
        {renderMemberList(
          adminMembers.members as (User | Organization)[],
          adminMembers.isLoading,
          adminMembers.isFetchingNextPage,
          false,
          adminMembers.lastItemRef
        )}
      </TabsContent>
    </Tabs>
  );

  const dialogs = (
    <>
      {showManagement && (
        <MemberManagementDialog
          entity={entity}
          open={showManagement}
          onOpenChange={(open) => {
            setShowManagement(open);
            if (!open) {
              refreshMembers();
            }
          }}
        />
      )}

      {showInvite && (
        <InviteMemberDialog
          entity={entity}
          open={showInvite}
          onOpenChange={(open) => {
            setShowInvite(open);
            if (!open) {
              refreshMembers();
            }
          }}
        />
      )}
    </>
  );

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
