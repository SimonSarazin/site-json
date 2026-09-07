/**
 * Calculateur de permissions cagnotte
 *
 * Sémantique :
 *  - "admin du projet" : `entity.isAdmin?.()` retourne `true` (ou `me` est propriétaire de l'entité courante)
 *  - "contributeur d'une action" : `me.id` figure dans `action.contributorIds`
 *  - "auteur d'une action" : `me.id` == `action.authorId` (celui qui l'a créée, même
 *    s'il ne s'y est pas assigné comme contributeur)
 *  - une action `done` ne peut plus être modifiée (sauf delete par admin)
 *  - un milestone `close` est figé (sauf restauration par admin)
 *  - un milestone avec financement encaissé ne peut être supprimé
 */
import type { EntityTypes, User } from "@communecter/cocolight-api-client";
import type {
  CagnotteActionLike,
  CagnotteMilestoneLike,
  CagnottePermissionData,
  CagnottePermissions,
} from "../types";
import { DEFAULT_CAGNOTTE_PERMISSIONS } from "../defaults";

type EntityWithRoles = EntityTypes & {
  isAdmin?: () => boolean;
  isContributor?: () => boolean;
};

function safeIsAdmin(entity: EntityTypes | null | undefined): boolean {
  if (!entity) return false;
  const e = entity as EntityWithRoles;
  try {
    return typeof e.isAdmin === "function" ? Boolean(e.isAdmin()) : false;
  } catch {
    return false;
  }
}

function safeIsContributor(entity: EntityTypes | null | undefined): boolean {
  if (!entity) return false;
  const e = entity as EntityWithRoles;
  try {
    return typeof e.isContributor === "function" ? Boolean(e.isContributor()) : false;
  } catch {
    return false;
  }
}

export function calculateCagnottePermissions(
  entity: EntityTypes | null,
  me: User | null,
  data?: CagnottePermissionData
): CagnottePermissions {
  const isConnected = Boolean(me?.isConnected);
  const currentUserId = me?.id?.trim() || "";

  const isResourceOwner =
    !!currentUserId && (data?.ownerIds ?? []).includes(currentUserId);

  if (!isConnected || (!entity && !isResourceOwner)) {
    return {
      ...DEFAULT_CAGNOTTE_PERMISSIONS,
      isConnected,
      currentUserId,
      canContributeReason: !isConnected ? "User not connected" : "No entity provided",
    };
  }

  const isAdmin = safeIsAdmin(entity) || isResourceOwner;
  const isContributor = safeIsContributor(entity);
  const hasActiveItems = data?.hasActiveItems ?? false;
  const resourceId = data?.resourceId ?? "";

  const isMilestoneEditable = (m: CagnotteMilestoneLike | null | undefined): boolean =>
    Boolean(m) && m!.status !== "close";

  const isUserContributorOf = (action: CagnotteActionLike | null | undefined): boolean => {
    if (!action || !currentUserId) return false;
    return (action.contributorIds ?? []).includes(currentUserId);
  };

  const isUserAuthorOf = (action: CagnotteActionLike | null | undefined): boolean => {
    if (!action || !currentUserId) return false;
    return String(action.authorId ?? "").trim() === currentUserId;
  };

  return {
    canContribute: Boolean(resourceId) && hasActiveItems,
    canContributeReason:
      !resourceId
        ? "No project selected"
        : !hasActiveItems
          ? "No active milestones to fund"
          : undefined,

    canCreateMilestone: isAdmin,
    canEditMilestone: (milestone) => isAdmin && isMilestoneEditable(milestone),
    canCloseMilestone: (milestone) => isAdmin && Boolean(milestone) && milestone!.status === "open",
    canRestoreMilestone: (milestone) =>
      isAdmin && Boolean(milestone) && milestone!.status === "close",
    canDeleteMilestone: (milestone) =>
      isAdmin && Boolean(milestone) && milestone!.hasTransactions !== true,

    canCreateAction: (milestone) => isAdmin && isMilestoneEditable(milestone),
    canEditAction: (action) => {
      if (!action) return false;
      // Une action "done" reste éditable par admin pour corrections, mais pas par un simple contributeur
      if (action.status === "done") return isAdmin;
      // Tant qu'elle n'est pas terminée, ceux qui la portent peuvent la corriger
      return isAdmin || isUserAuthorOf(action) || isUserContributorOf(action);
    },
    canMarkActionDone: (action) => {
      if (!action || action.status !== "todo") return false;
      // Symétrique de `canEditAction` : qui peut corriger une action non terminée peut
      // la clore.
      return isAdmin || isUserAuthorOf(action) || isUserContributorOf(action);
    },
    canDeleteAction: () => isAdmin,
    canCandidateAction: (action) => {
      if (!action || action.status !== "todo") return false;
      if (!currentUserId) return false;
      return !isUserContributorOf(action);
    },

    isConnected,
    isAdmin,
    isContributor,
    currentUserId,
  };
}
