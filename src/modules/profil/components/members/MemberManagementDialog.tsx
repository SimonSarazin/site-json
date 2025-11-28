import { useState } from "react";
import { useT } from "@/hooks/useT";
import { useEntityMembers } from "../../hooks/useMembersQuery";
import type { EntityTypes } from "@communecter/cocolight-api-client";
import { useEntityLabels } from "../../hooks/useEntityLabels";
import { useConfirmationDialog } from "../../hooks/useConfirmationDialog";
import { ConfirmationDialog } from "./ConfirmationDialog";
import { MemberListRenderer } from "./MemberListRenderer";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  Settings,
  Search,
} from "lucide-react";

interface MemberManagementDialogProps {
  entity: EntityTypes | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MemberManagementDialog({ entity, open, onOpenChange }: MemberManagementDialogProps) {
  const t = useT("modules/profil");
  const [activeTab, setActiveTab] = useState("pending");
  const [searchTerm, setSearchTerm] = useState("");
  const { confirmation, showConfirmation, hideConfirmation, executeAction } = useConfirmationDialog();

  // Queries
  const allMembers = useEntityMembers(entity, { toBeValidated: false }, { search: searchTerm });
  const pendingMembers = useEntityMembers(entity, { toBeValidated: true }, { search: searchTerm });
  const adminMembers = useEntityMembers(entity, { isAdmin: true }, { search: searchTerm });

  // Labels spécifiques à l'entité
  const labels = useEntityLabels(entity);

  if (!entity) return null;
  
  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-4xl max-h-[80vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Settings className="h-5 w-5" />
              <span>{labels.managementTitle}</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder={t("MemberManagementDialog.searchPlaceholder")}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList>
                <TabsTrigger value="pending">
                  {labels.pending} ({pendingMembers.totalCount || 0})
                </TabsTrigger>
                <TabsTrigger value="all">
                  {labels.members} ({allMembers.totalCount || 0})
                </TabsTrigger>
                <TabsTrigger value="admins">
                  {labels.admin}s ({adminMembers.totalCount || 0})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="pending" className="mt-4 max-h-96 overflow-y-auto">
                <MemberListRenderer
                  members={pendingMembers.members || []}
                  entity={entity}
                  isLoading={pendingMembers.isLoading}
                  showActions={true}
                  showBadges={false}
                  isPending={true}
                  lastItemRef={pendingMembers.lastItemRef}
                  isFetchingNextPage={pendingMembers.isFetchingNextPage}
                  showConfirmation={showConfirmation}
                />
              </TabsContent>

              <TabsContent value="all" className="mt-4 max-h-96 overflow-y-auto">
                <MemberListRenderer
                  members={allMembers.members || []}
                  entity={entity}
                  isLoading={allMembers.isLoading}
                  showActions={true}
                  showBadges={true}
                  isPending={false}
                  lastItemRef={allMembers.lastItemRef}
                  isFetchingNextPage={allMembers.isFetchingNextPage}
                  showConfirmation={showConfirmation}
                />
              </TabsContent>

              <TabsContent value="admins" className="mt-4 max-h-96 overflow-y-auto">
                <MemberListRenderer
                  members={adminMembers.members || []}
                  entity={entity}
                  isLoading={adminMembers.isLoading}
                  showActions={true}
                  showBadges={true}
                  isPending={false}
                  lastItemRef={adminMembers.lastItemRef}
                  isFetchingNextPage={adminMembers.isFetchingNextPage}
                  showConfirmation={showConfirmation}
                />
              </TabsContent>
            </Tabs>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <ConfirmationDialog
        confirmation={confirmation}
        onOpenChange={hideConfirmation}
        onConfirm={executeAction}
      />
    </>
  );
}