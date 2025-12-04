import type { User, Organization, EntityTypes } from "@communecter/cocolight-api-client";
import { useT } from "@/hooks/useT";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Users, Check, X, MoreVertical } from "lucide-react";
import { useUserStatusBadge } from "../../hooks/useUserStatusBadge";
import { useUserActions } from "../../hooks/useUserActions";
import { LoadingState, EmptyState, UserListItem } from "../shared";

interface MemberListRendererProps {
  members: (User | Organization)[];
  entity: EntityTypes | null;
  isLoading: boolean;
  showActions?: boolean;
  showBadges?: boolean;
  isPending?: boolean;
  lastItemRef?: (node: HTMLElement | null) => void;
  isFetchingNextPage?: boolean;
  showConfirmation?: (config: {
    title: string;
    description: string;
    action: () => void;
    isDestructive?: boolean;
  }) => void;
}

/**
 * Composant réutilisable pour le rendu des listes de membres
 * Mutualise la logique entre ProfileMembers et MemberManagementDialog
 */
export function MemberListRenderer({
  members,
  entity,
  isLoading,
  showActions = false,
  showBadges = false,
  isPending = false,
  lastItemRef,
  isFetchingNextPage,
  showConfirmation,
}: MemberListRendererProps) {
  const t = useT("modules/profil");
  const { getUserStatusBadge } = useUserStatusBadge();
  const { getUserActionButtons } = useUserActions(
    entity,
    showConfirmation || (() => {})
  );

  // État de chargement
  if (isLoading) {
    return <LoadingState variant="list" rows={3} />;
  }

  // Liste vide
  if (!members || members.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title={
          isPending
            ? t("MemberManagementDialog.noPending")
            : t("ProfileMembers.noMembers")
        }
        variant="compact"
      />
    );
  }

  // Rendu des actions pour un membre
  const renderMemberActions = (member: User | Organization) => {
    if (!showActions || !showConfirmation) return null;

    // Actions spéciales pour les membres en attente
    if (isPending) {
      return (
        <div className="flex items-center space-x-2">
          <Button
            size="sm"
            variant="default"
            onClick={() =>
              showConfirmation({
                title: t("MemberManagementDialog.acceptDialog.title"),
                description: t(
                  "MemberManagementDialog.acceptDialog.description",
                  undefined,
                  { name: member.serverData?.name }
                ),
                action: () => {
                  const actions = getUserActionButtons(member);
                  const validateAction = actions.find(
                    (a) => a.id === "validate"
                  );
                  validateAction?.onClick();
                },
              })
            }
          >
            <Check className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() =>
              showConfirmation({
                title: t("MemberManagementDialog.rejectDialog.title"),
                description: t(
                  "MemberManagementDialog.rejectDialog.description",
                  undefined,
                  { name: member.serverData?.name }
                ),
                action: () => {
                  const actions = getUserActionButtons(member);
                  const rejectAction = actions.find((a) => a.id === "reject");
                  rejectAction?.onClick();
                },
                isDestructive: true,
              })
            }
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      );
    }

    // Actions générales via le hook useUserActions
    const actions = getUserActionButtons(member);
    if (actions.length === 0) return null;

    // Si une seule action, afficher le bouton directement
    if (actions.length === 1) {
      const action = actions[0];
      return (
        <Button
          size="sm"
          variant={action.variant}
          onClick={action.onClick}
          disabled={action.disabled}
        >
          {action.icon}
          <span className="hidden sm:inline ml-1">{action.label}</span>
        </Button>
      );
    }

    // Si plusieurs actions, utiliser un dropdown menu
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="outline">
            <MoreVertical className="w-4 h-4" />
            <span className="hidden sm:inline ml-1">Actions</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {actions.map((action, index) => (
            <div key={action.id}>
              <DropdownMenuItem
                onClick={action.onClick}
                disabled={action.disabled}
                className={action.variant === "destructive" ? "text-destructive" : ""}
              >
                {action.icon}
                <span className="ml-2">{action.label}</span>
              </DropdownMenuItem>
              {index < actions.length - 1 && action.variant === "destructive" && (
                <DropdownMenuSeparator />
              )}
            </div>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  return (
    <div className="space-y-3">
      {members.map((member: User | Organization, index: number) => (
        <UserListItem
          key={member.id}
          ref={index === members.length - 1 ? lastItemRef : undefined}
          user={member}
          subtitle={member.serverData?.email}
          variant="card"
          badge={showBadges ? getUserStatusBadge(member, entity) : undefined}
          actions={renderMemberActions(member)}
        />
      ))}

      {/* Indicateur de chargement pour le scroll infini */}
      {isFetchingNextPage && (
        <LoadingState
          variant="spinner"
          size="sm"
          message={t("ProfileMembers.loadingMore")}
        />
      )}
    </div>
  );
}
