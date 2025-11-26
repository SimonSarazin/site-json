import { useState } from "react";
import { useT } from "@/hooks/useT";
import { useProfileEntity } from "../../hooks/useProfileEntity";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { useEntityMembers } from "../../hooks/useMembersQuery";
import { isOrganization, isProject, isEvent } from "@/lib/getTypedEntity";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MemberManagementDialog } from "../members/MemberManagementDialog";
import { InviteMemberDialog } from "../members/InviteMemberDialog";
import { Users, UserPlus, Settings } from "lucide-react";

interface ProfileMembersProps {
  section: {
    type: "profile-members";
    title?: { fr?: string; en?: string };
    limit?: number;
    showRole?: boolean;
    showManagement?: boolean;
  };
}

export default function ProfileMembers({ section }: ProfileMembersProps) {
  const t = useT("modules/profil");
  const { entity } = useProfileEntity();
  const permissions = useUserPermissions(entity);
  const [selectedTab, setSelectedTab] = useState("all");
  const [showManagement, setShowManagement] = useState(false);
  const [showInvite, setShowInvite] = useState(false);

  // Récupérer les membres selon l'onglet sélectionné
  const allMembers = useEntityMembers(entity, { toBeValidated: false }, {});
  const pendingMembers = useEntityMembers(entity, { toBeValidated: true }, {});
  const adminMembers = useEntityMembers(entity, { isAdmin: true }, {});

  // console.log("allMembers.members", allMembers.members);
  
  if (!entity) return null;

  // Déterminer les labels selon le type d'entité
  const getEntityLabels = () => {
    if (isOrganization(entity)) {
      return {
        title: t("ProfileMembers.organization.title"),
        member: t("ProfileMembers.organization.member"),
        members: t("ProfileMembers.organization.members"),
        admin: t("ProfileMembers.organization.admin"),
        pending: t("ProfileMembers.organization.pending"),
        invite: t("ProfileMembers.organization.invite"),
      };
    } else if (isProject(entity)) {
      return {
        title: t("ProfileMembers.project.title"),
        member: t("ProfileMembers.project.contributor"),
        members: t("ProfileMembers.project.contributors"),
        admin: t("ProfileMembers.project.admin"),
        pending: t("ProfileMembers.project.pending"),
        invite: t("ProfileMembers.project.invite"),
      };
    } else if (isEvent(entity)) {
      return {
        title: t("ProfileMembers.event.title"),
        member: t("ProfileMembers.event.participant"),
        members: t("ProfileMembers.event.participants"),
        admin: t("ProfileMembers.event.author"),
        pending: t("ProfileMembers.event.pending"),
        invite: t("ProfileMembers.event.invite"),
      };
    }
    return {
      title: t("ProfileMembers.title"),
      member: t("ProfileMembers.member"),
      members: t("ProfileMembers.members"),
      admin: t("ProfileMembers.admin"),
      pending: t("ProfileMembers.pending"),
      invite: t("ProfileMembers.invite"),
    };
  };

  const labels = getEntityLabels();
  const title = (section.title && typeof section.title === 'object' && 'fr' in section.title) ?
    (section.title as any)[navigator?.language?.startsWith('fr') ? 'fr' : 'en'] ||
    (section.title as any).en ||
    labels.title : labels.title;

  // Fonction pour rendre une liste de membres
  const renderMemberList = (
    members: any[],
    isLoading: boolean,
    lastItemRef?: (node: HTMLElement | null) => void,
    isFetchingNextPage?: boolean,
    hasNextPage?: boolean
  ) => {

    console.log("Rendering members:", isFetchingNextPage, isLoading);
    if (isLoading) {
      return (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center space-x-3 animate-pulse">
              <div className="h-10 w-10 bg-gray-200 rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-1/3" />
                <div className="h-3 bg-gray-200 rounded w-1/4" />
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (!members || members.length === 0) {
      return (
        <div className="text-center py-8 text-gray-500">
          <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>{t("ProfileMembers.noMembers")}</p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {members.map((member: any, index: number) => (
          <div
            key={member.id}
            className="flex items-center justify-between p-3 border rounded-lg"
          >
            <div className="flex items-center space-x-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={member.serverData?.profilThumbImageUrl} alt={member.serverData.name} />
                <AvatarFallback>{member.serverData.name?.[0] || "?"}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium">{member.serverData.name}</p>
                <p className="text-sm text-gray-500">{member.serverData.email}</p>
              </div>
            </div>
            {/* {section.showRole && (
              <div className="flex items-center space-x-2">

              </div>
            )} */}
          </div>
        ))}

        <div ref={lastItemRef} className="h-12" />

        {/* Infinite scroll loading indicator */}
        {isFetchingNextPage && (
          <div className="flex justify-center py-4 text-muted-foreground">
            <div className="flex items-center space-x-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
              <span>{t("ProfileMembers.loadingMore")}</span>
            </div>
          </div>
        )}
      </div>
    );
  };

  console.log("permissions.isAdmin", permissions.isAdmin);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <Users className="h-5 w-5" />
            <span>{title}</span>
          </CardTitle>
          {(permissions.isAdmin || (isEvent(entity) && permissions.isAuthor)) && (
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowInvite(true)}
                disabled={!permissions.canEditProfile}
              >
                <UserPlus className="h-4 w-4 mr-1" />
                {labels.invite}
              </Button>
              {section.showManagement && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowManagement(true)}
                  disabled={!permissions.canEditProfile}
                >
                  <Settings className="h-4 w-4 mr-1" />
                  {t("ProfileMembers.manage")}
                </Button>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={selectedTab} onValueChange={setSelectedTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="all">
              {labels.members} ({allMembers.totalCount})
            </TabsTrigger>
            {(permissions.isAdmin || (isEvent(entity) && permissions.isAuthor)) && (
              <TabsTrigger value="pending">
                {labels.pending} ({pendingMembers.totalCount})
              </TabsTrigger>
            )}
            <TabsTrigger value="admins">
              {labels.admin}s ({adminMembers.totalCount})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-4">
            {renderMemberList(
              allMembers.members || [],
              allMembers.isLoading,
              allMembers.lastItemRef,
              allMembers.isFetchingNextPage,
              allMembers.hasNextPage
            )}
          </TabsContent>

          {(permissions.isAdmin || (isEvent(entity) && permissions.isAuthor)) && (
            <TabsContent value="pending" className="mt-4">
              {renderMemberList(
                pendingMembers.members || [],
                pendingMembers.isLoading,
                pendingMembers.lastItemRef,
                pendingMembers.isFetchingNextPage,
                pendingMembers.hasNextPage
              )}
            </TabsContent>
          )}

          <TabsContent value="admins" className="mt-4">
            {renderMemberList(
              adminMembers.members || [],
              adminMembers.isLoading,
              adminMembers.lastItemRef,
              adminMembers.isFetchingNextPage,
              adminMembers.hasNextPage
            )}
          </TabsContent>
        </Tabs>
      </CardContent>

      {/* Dialogs */}
      {showManagement && (
      <MemberManagementDialog
        entity={entity}
        open={showManagement}
        onOpenChange={setShowManagement}
      />
      )}

      {showInvite && (
      <InviteMemberDialog
        entity={entity}
        open={showInvite}
        onOpenChange={setShowInvite}
      />
      )}
    </Card>
  );
}
