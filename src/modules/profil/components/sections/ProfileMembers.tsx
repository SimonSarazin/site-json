import { useState } from "react";
import { useT } from "@/hooks/useT";
import { useProfileEntity } from "../../hooks/useProfileEntity";
import { useProfilPermissions } from "../../hooks/useProfilPermissions";
import { useEntityMembers } from "../../hooks/useMembersQuery";
import { useConfirmationDialog } from "../../hooks/useConfirmationDialog";
import { isEvent } from "@/lib/getTypedEntity";
import { useEntityLabels } from "../../hooks/useEntityLabels";
import { MemberListRenderer } from "../members/MemberListRenderer";
import { ConfirmationDialog } from "../members/ConfirmationDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MemberManagementDialog } from "../members/MemberManagementDialog";
import { InviteMemberDialog } from "../members/InviteMemberDialog";
import { Users, UserPlus, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProfileMembersSection } from "../../schema";

interface ProfileMembersProps {
  section: ProfileMembersSection;
}

export default function ProfileMembers({ section }: ProfileMembersProps) {
  const t = useT("modules/profil");
  const { entity } = useProfileEntity();
  const permissions = useProfilPermissions(entity);
  const [selectedTab, setSelectedTab] = useState("all");
  const [showManagement, setShowManagement] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const { confirmation, showConfirmation, hideConfirmation, executeAction } = useConfirmationDialog();

  // Récupérer les membres selon l'onglet sélectionné
  const allMembers = useEntityMembers(entity, { toBeValidated: false }, {});
  const pendingMembers = useEntityMembers(entity, { toBeValidated: true }, {});
  const adminMembers = useEntityMembers(entity, { isAdmin: true }, {});

  // Labels spécifiques à l'entité
  const labels = useEntityLabels(entity);

  if (!entity) return null;

  const title = section.title ? t(section.title) : labels.title;
  const canManageInline = permissions.isAdmin || (isEvent(entity) && permissions.isAuthor);


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
                <UserPlus className="h-4 w-4 sm:mr-1" />
                <span className="hidden sm:inline">{labels.invite}</span>
              </Button>
              {section.showManagement && (
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
        <Tabs value={selectedTab} onValueChange={setSelectedTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="all" className={cn(
              "text-xs sm:text-sm"
            )}>
              {labels.members} ({allMembers.totalCount})
            </TabsTrigger>
            {(permissions.isAdmin || (isEvent(entity) && permissions.isAuthor)) && (
              <TabsTrigger value="pending" className={cn(
              "text-xs sm:text-sm"
            )}>
                {labels.pending} ({pendingMembers.totalCount})
              </TabsTrigger>
            )}
            <TabsTrigger value="admins" className={cn(
              "text-xs sm:text-sm"
            )}>
              {labels.admin}s ({adminMembers.totalCount})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-4">
            <MemberListRenderer
              members={allMembers.members || []}
              entity={entity}
              isLoading={allMembers.isLoading}
              showActions={canManageInline}
              showBadges={section.showRole}
              isPending={false}
              lastItemRef={allMembers.lastItemRef}
              isFetchingNextPage={allMembers.isFetchingNextPage}
              showConfirmation={canManageInline ? showConfirmation : undefined}
            />
          </TabsContent>

          {canManageInline && (
            <TabsContent value="pending" className="mt-4">
              <MemberListRenderer
                members={pendingMembers.members || []}
                entity={entity}
                isLoading={pendingMembers.isLoading}
                showActions={true}
                showBadges={section.showRole}
                isPending={true}
                lastItemRef={pendingMembers.lastItemRef}
                isFetchingNextPage={pendingMembers.isFetchingNextPage}
                showConfirmation={showConfirmation}
              />
            </TabsContent>
          )}

          <TabsContent value="admins" className="mt-4">
            <MemberListRenderer
              members={adminMembers.members || []}
              entity={entity}
              isLoading={adminMembers.isLoading}
              showActions={canManageInline}
              showBadges={section.showRole}
              isPending={false}
              lastItemRef={adminMembers.lastItemRef}
              isFetchingNextPage={adminMembers.isFetchingNextPage}
              showConfirmation={canManageInline ? showConfirmation : undefined}
            />
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

      <ConfirmationDialog
        confirmation={confirmation}
        onOpenChange={hideConfirmation}
        onConfirm={executeAction}
      />
    </Card>
  );
}
