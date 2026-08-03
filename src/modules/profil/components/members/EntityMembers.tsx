import "@/modules/profil/i18n";
import { useState } from "react";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { useDebounce } from "@/hooks/useDebounce";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Users, UserPlus, Settings, Search, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EntityTypes, Organization, User, SearchEntity } from "@communecter/cocolight-api-client";
import type { LocalizedString } from "@/types/locale-schema";
import { isEvent, isOrganization, isProject } from "@/lib/getTypedEntity";
import { useEntityMembers } from "../../hooks/useMembersQuery";
import { useEntityLabels } from "../../hooks/useEntityLabels";
import { useProfilPermissions } from "../../hooks/useProfilPermissions";
import { useConfirmationDialog } from "../../hooks/useConfirmationDialog";
import { PROFIL_QUERY_KEYS } from "../../constants/queryKeys";
import { MemberListRenderer } from "./MemberListRenderer";
import { MemberManagementDialog } from "./MemberManagementDialog";
import { InviteMemberDialog } from "./InviteMemberDialog";
import { ConfirmationDialog } from "./ConfirmationDialog";
import CardProfile from "@/modules/search/components/card/CardProfile";
import { SwitchDetailsMode } from "@/modules/search/components/SwitchDetailsMode";

export interface MemberCardConfig {
  type?: "default" | "profile";
  showDescription?: boolean;
  showAddress?: boolean;
  /** Bloc de compteurs de `CardProfile`. Absent = affiché — cf. `MemberCardConfSchema.showStats`. */
  showStats?: boolean;
  detailsMode?: "drawer" | "dialog" | "link";
}

interface EntityMembersProps {
  /** Entité résolue (org → membres, projet → contributeurs, event → participants). */
  entity: EntityTypes | null;
  title?: LocalizedString | string;
  /** Affiche les badges de rôle sur les cartes. */
  showRole?: boolean;
  /** Affiche le bouton "Gérer" (admins). */
  showManagement?: boolean;
  /** Active les actions inline (gérer/confirmer) — mode page de profil. */
  showActions?: boolean;
  /** Affiche l'input de recherche. */
  search?: boolean;
  /** Enveloppe dans une `<Card>` (défaut: true). */
  showCard?: boolean;
  /** Mode de rendu des cartes. */
  card?: MemberCardConfig;
}

type MemberItem = User | Organization;

/** Grille de cartes "profile" (CardProfile) avec ouverture de détail (drawer/dialog). */
function ProfileCardList({
  members,
  isLoading,
  isFetchingNextPage,
  showRole,
  isPending,
  card,
  lastItemRef,
  emptyLabel,
  loadingMoreLabel,
}: {
  members: MemberItem[];
  isLoading?: boolean;
  isFetchingNextPage?: boolean;
  showRole?: boolean;
  isPending?: boolean;
  card?: MemberCardConfig;
  lastItemRef?: (node: HTMLElement | null) => void;
  emptyLabel: string;
  loadingMoreLabel: string;
}) {
  const [openDetails, setOpenDetails] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MemberItem | null>(null);
  const detailsMode = card?.detailsMode || "link";

  const handleOpenDetails = (member: MemberItem) => {
    if (detailsMode === "link") return;
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
    return <div className="text-center py-12 text-muted-foreground">{emptyLabel}</div>;
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
              showBadges={showRole}
              isPending={isPending}
              card={{
                showDescription: card?.showDescription,
                showAddress: card?.showAddress,
                showStats: card?.showStats,
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
          <span className="ml-2 text-sm text-muted-foreground">{loadingMoreLabel}</span>
        </div>
      )}

      {selectedItem && detailsMode !== "link" && (
        <SwitchDetailsMode
          openDetails={openDetails}
          setOpenDetails={setOpenDetails}
          item={selectedItem as unknown as SearchEntity}
          card={{ detailsMode: detailsMode === "drawer" ? "drawer" : "dialog" }}
        />
      )}
    </div>
  );
}

/**
 * Cœur générique d'affichage des membres d'une entité (org → membres,
 * projet → contributeurs, event → participants). Onglets all/pending/admins,
 * recherche optionnelle, dialogs invite/gestion, modes liste ou cartes-profil.
 *
 * Consommé par `<ProfileMembers>` (onglet de profil) et la section `member`.
 */
export function EntityMembers({
  entity,
  title,
  showRole,
  showManagement,
  showActions = false,
  search = false,
  showCard = true,
  card,
}: EntityMembersProps) {
  useLoadNamespace("modules/profil");
  const t = useT("modules/profil");
  const queryClient = useQueryClient();

  const [selectedTab, setSelectedTab] = useState("all");
  const [showInvite, setShowInvite] = useState(false);
  const [showManagementDialog, setShowManagementDialog] = useState(false);
  const { confirmation, showConfirmation, hideConfirmation, executeAction } = useConfirmationDialog();

  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebounce(searchInput, 400);

  const permissions = useProfilPermissions(entity);
  const labels = useEntityLabels(entity);

  const canManage = permissions.isAdmin || (entity ? isEvent(entity) && permissions.isAuthor : false);
  const canManageInline = showActions && canManage;

  // La recherche n'est appliquée qu'à l'onglet actif (évite de relancer 3 requêtes par frappe).
  const searchParams = search && debouncedSearch.trim() ? { search: debouncedSearch.trim() } : {};
  const all = useEntityMembers(entity, { toBeValidated: false }, selectedTab === "all" ? searchParams : {});
  const pending = useEntityMembers(entity, { toBeValidated: true }, selectedTab === "pending" ? searchParams : {});
  const admins = useEntityMembers(entity, { isAdmin: true }, selectedTab === "admins" ? searchParams : {});

  /** Rafraîchit la liste après invitation/gestion — clé basée sur le slug + type (bug historique : clé par ID). */
  const refresh = () => {
    if (!entity) return;
    const slug = entity.slug ?? null;
    if (isOrganization(entity)) {
      queryClient.invalidateQueries({ queryKey: PROFIL_QUERY_KEYS.ORGANIZATION_MEMBERS_PREFIX(slug) });
    } else if (isProject(entity)) {
      queryClient.invalidateQueries({ queryKey: PROFIL_QUERY_KEYS.PROJECT_CONTRIBUTORS_PREFIX(slug) });
    } else if (isEvent(entity)) {
      queryClient.invalidateQueries({ queryKey: PROFIL_QUERY_KEYS.EVENT_ATTENDEES_PREFIX(slug) });
    }
  };

  if (!entity) return null;

  const resolvedTitle = title ? t(title) : labels.title;
  const useProfileCard = card?.type === "profile";

  const renderList = (
    bucket: ReturnType<typeof useEntityMembers>,
    isPending: boolean
  ) => {
    const members = (bucket.members || []) as MemberItem[];
    if (useProfileCard) {
      return (
        <ProfileCardList
          members={members}
          isLoading={bucket.isLoading}
          isFetchingNextPage={bucket.isFetchingNextPage}
          showRole={showRole}
          isPending={isPending}
          card={card}
          lastItemRef={bucket.lastItemRef}
          emptyLabel={t("ProfileMembers.noMembers")}
          loadingMoreLabel={t("ProfileMembers.loadingMore")}
        />
      );
    }
    return (
      <MemberListRenderer
        members={members}
        entity={entity}
        isLoading={bucket.isLoading}
        showActions={canManageInline}
        showBadges={showRole}
        isPending={isPending}
        lastItemRef={bucket.lastItemRef}
        isFetchingNextPage={bucket.isFetchingNextPage}
        showConfirmation={canManageInline ? showConfirmation : undefined}
      />
    );
  };

  const header = (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center space-x-2 text-xl font-semibold">
          <Users className="h-5 w-5" />
          <span>{resolvedTitle}</span>
        </div>
        {canManage && (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowInvite(true)} disabled={!permissions.canEditProfile}>
              <UserPlus className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">{labels.invite}</span>
            </Button>
            {showManagement && (
              <Button variant="outline" size="sm" onClick={() => setShowManagementDialog(true)} disabled={!permissions.canEditProfile}>
                <Settings className="h-4 w-4 sm:mr-1" />
                <span className="hidden sm:inline">{t("ProfileMembers.manage")}</span>
              </Button>
            )}
          </div>
        )}
      </div>
      {search && (
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder={t("ProfileMembers.searchPlaceholder")}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9 w-full h-9"
          />
        </div>
      )}
    </div>
  );

  const tabs = (
    <Tabs value={selectedTab} onValueChange={setSelectedTab}>
      <TabsList className={cn("grid w-full", canManage ? "grid-cols-3" : "grid-cols-2")}>
        <TabsTrigger value="all" className="text-xs sm:text-sm">
          {labels.members} ({all.totalCount})
        </TabsTrigger>
        {canManage && (
          <TabsTrigger value="pending" className="text-xs sm:text-sm">
            {labels.pending} ({pending.totalCount})
          </TabsTrigger>
        )}
        <TabsTrigger value="admins" className="text-xs sm:text-sm">
          {labels.admin}s ({admins.totalCount})
        </TabsTrigger>
      </TabsList>

      <TabsContent value="all" className="mt-4">{renderList(all, false)}</TabsContent>
      {canManage && <TabsContent value="pending" className="mt-4">{renderList(pending, true)}</TabsContent>}
      <TabsContent value="admins" className="mt-4">{renderList(admins, false)}</TabsContent>
    </Tabs>
  );

  const dialogs = (
    <>
      {showManagementDialog && (
        <MemberManagementDialog
          entity={entity}
          open={showManagementDialog}
          onOpenChange={(open) => {
            setShowManagementDialog(open);
            if (!open) refresh();
          }}
        />
      )}
      {showInvite && (
        <InviteMemberDialog
          entity={entity}
          open={showInvite}
          onOpenChange={(open) => {
            setShowInvite(open);
            if (!open) refresh();
          }}
        />
      )}
      <ConfirmationDialog confirmation={confirmation} onOpenChange={hideConfirmation} onConfirm={executeAction} />
    </>
  );

  if (!showCard) {
    return (
      <div className="flex flex-col gap-3">
        {header}
        {tabs}
        {dialogs}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>{header}</CardHeader>
      <CardContent>{tabs}</CardContent>
      {dialogs}
    </Card>
  );
}

export default EntityMembers;
