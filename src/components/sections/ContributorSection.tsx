import { useState } from "react";
import { useT } from "@/hooks/useT";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Users, UserPlus, Settings, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ContributorSection as ContributorSectionType } from "@/types/site-schema";
import type { Project, User, Organization } from "@communecter/cocolight-api-client";
import { MemberListRenderer } from "@/modules/profil/components/members/MemberListRenderer";
import { MemberManagementDialog } from "@/modules/profil/components/members/MemberManagementDialog";
import { InviteMemberDialog } from "@/modules/profil/components/members/InviteMemberDialog";
import { useProfilPermissions } from "@/modules/profil/hooks/useProfilPermissions";
import { useEntityLabels } from "@/modules/profil/hooks/useEntityLabels";
import { useProjectContributors } from "@/modules/profil/hooks/useMembersQuery";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { isProject } from "@/lib/getTypedEntity";
import { useCocolight } from "@/hooks/useCocolight";
import CardProfile from "@/modules/search/components/card/CardProfile";
import { SwitchDetailsMode } from "@/modules/search/components/SwitchDetailsMode";

interface ContributorSectionProps {
  id?: string;
  props: ContributorSectionType["props"];
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
  cardConfig?: ContributorSectionType["props"]["card"];
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

  // Utiliser useProjectContributors pour les différentes listes
  const allContributors = useProjectContributors(project || null, { toBeValidated: false });
  const pendingContributors = useProjectContributors(project || null, { toBeValidated: true });
  const adminContributors = useProjectContributors(project || null, { isAdmin: true });

  // Type de card à utiliser (default = MemberListRenderer, profile = CardProfile)
  const cardType = props.card?.type || "default";
  const useProfileCard = cardType === "profile";

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
        entity={project}
        isLoading={isLoading}
        showActions={false}
        showBadges={props.showRole}
        isPending={isPending}
        lastItemRef={lastItemRef}
        isFetchingNextPage={isFetchingNextPage}
      />
    );
  };

  // Contenu des tabs
  const tabsContent = (
    <Tabs value={selectedTab} onValueChange={setSelectedTab}>
      <TabsList className={cn(
        "grid w-full",
        permissions.isAdmin ? "grid-cols-3" : "grid-cols-2"
      )}>
        <TabsTrigger value="all" className={cn("text-xs sm:text-sm")}>
          {labels.members} ({allContributors.totalCount})
        </TabsTrigger>
        {permissions.isAdmin && (
          <TabsTrigger value="pending" className={cn("text-xs sm:text-sm")}>
            {labels.pending} ({pendingContributors.totalCount})
          </TabsTrigger>
        )}
        <TabsTrigger value="admins" className={cn("text-xs sm:text-sm")}>
          {labels.admin}s ({adminContributors.totalCount})
        </TabsTrigger>
      </TabsList>

      <TabsContent value="all" className="mt-4">
        {renderMemberList(
          allContributors.contributors as (User | Organization)[],
          allContributors.isLoading,
          allContributors.isFetchingNextPage,
          false,
          allContributors.lastItemRef
        )}
      </TabsContent>

      {permissions.isAdmin && (
        <TabsContent value="pending" className="mt-4">
          {renderMemberList(
            pendingContributors.contributors as (User | Organization)[],
            pendingContributors.isLoading,
            pendingContributors.isFetchingNextPage,
            true,
            pendingContributors.lastItemRef
          )}
        </TabsContent>
      )}

      <TabsContent value="admins" className="mt-4">
        {renderMemberList(
          adminContributors.contributors as (User | Organization)[],
          adminContributors.isLoading,
          adminContributors.isFetchingNextPage,
          false,
          adminContributors.lastItemRef
        )}
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
              refreshContributors();
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
