import { Search, UserPlus } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCocolight } from "@/hooks/useCocolight";
import { useDebounce } from "@/hooks/useDebounce";
import { useT } from "@/hooks/useT";
import { ConfirmationDialog } from "@/modules/profil/components/members/ConfirmationDialog";
import { InviteMemberDialog } from "@/modules/profil/components/members/InviteMemberDialog";
import { MemberListRenderer } from "@/modules/profil/components/members/MemberListRenderer";
import { useConfirmationDialog } from "@/modules/profil/hooks/useConfirmationDialog";
import { useEntityLabels } from "@/modules/profil/hooks/useEntityLabels";
import { useEntityMembers } from "@/modules/profil/hooks/useMembersQuery";
import "@/modules/profil/i18n";

import type { AdminSection } from "../schema";

/**
 * Section `members` (P1) — gestion de la communauté du CARRIER costum : élévation de
 * MemberManagementDialog (profil) en section pleine page. Réutilise tel quel :
 *  - `useEntityMembers` (filtres toBeValidated/isAdmin + recherche) — legacy CommunityAction ;
 *  - `MemberListRenderer` + `useAdminActions` (valider/refuser/promouvoir/rétrograder/retirer via
 *    connect/disconnect/validate/updateadminlink) ;
 *  - `InviteMemberDialog` (invitation unitaire + email + recherche multi = multiconnect).
 * cf. plan §3 · commentaire/plan-module-admin-generique.md
 */
export default function MembersSection({ section: _section }: { section: AdminSection }) {
  const { entity } = useCocolight();
  const t = useT("modules/profil");
  const [activeTab, setActiveTab] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const debouncedSearch = useDebounce(searchTerm, 300);
  const { confirmation, showConfirmation, hideConfirmation, executeAction } = useConfirmationDialog();

  const allMembers = useEntityMembers(entity, { toBeValidated: false }, { search: debouncedSearch });
  const pendingMembers = useEntityMembers(entity, { toBeValidated: true }, { search: debouncedSearch });
  const adminMembers = useEntityMembers(entity, { isAdmin: true }, { search: debouncedSearch });
  const labels = useEntityLabels(entity);

  if (!entity) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Aucune entité porteuse (carrier) : la gestion des membres nécessite un costum porteur.
        </CardContent>
      </Card>
    );
  }

  const tabs = [
    { id: "pending", label: `${labels.pending} (${pendingMembers.totalCount || 0})`, q: pendingMembers, isPending: true, showBadges: false },
    { id: "all", label: `${labels.members} (${allMembers.totalCount || 0})`, q: allMembers, isPending: false, showBadges: true },
    { id: "admins", label: `${labels.admin}s (${adminMembers.totalCount || 0})`, q: adminMembers, isPending: false, showBadges: true },
  ];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-lg">{labels.managementTitle}</CardTitle>
        <Button size="sm" onClick={() => setInviteOpen(true)}>
          <UserPlus className="mr-2 h-4 w-4" />
          Inviter
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("MemberManagementDialog.searchPlaceholder")}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            {tabs.map((tab) => (
              <TabsTrigger key={tab.id} value={tab.id}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {tabs.map((tab) => (
            <TabsContent key={tab.id} value={tab.id} className="mt-4 max-h-[32rem] overflow-y-auto">
              <MemberListRenderer
                members={tab.q.members || []}
                entity={entity}
                isLoading={tab.q.isLoading}
                showActions={true}
                showBadges={tab.showBadges}
                isPending={tab.isPending}
                lastItemRef={tab.q.lastItemRef}
                isFetchingNextPage={tab.q.isFetchingNextPage}
                showConfirmation={showConfirmation}
              />
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>

      <ConfirmationDialog confirmation={confirmation} onOpenChange={hideConfirmation} onConfirm={executeAction} />
      <InviteMemberDialog entity={entity} open={inviteOpen} onOpenChange={setInviteOpen} />
    </Card>
  );
}
