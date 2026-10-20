/**
 * Calculateur de permissions cagnotte
 *
 * Sémantique :
 *  - "admin du projet" : `entity.isAdmin?.()` retourne `true` (ou `me` est propriétaire de l'entité courante)
 *  - "contributeur d'une action" : `me.id` figure dans `action.contributorIds`
 *  - "auteur d'une action" : `me.id` == `action.authorId` (celui qui l'a créée, même
 *    s'il ne s'y est pas assigné comme contributeur) — il peut la corriger ET la supprimer
 *  - une action `done` se ferme à tous sauf à l'admin (édition comme suppression)
 *  - un milestone `close` est figé (sauf restauration par admin)
 *  - un milestone avec financement encaissé ne peut être supprimé
 *
 * ⚠️ Une entité absente ne vaut PAS « aucun droit ». Les règles au niveau action
 * (auteur, contributeur assigné) ne demandent que `me.id` et l'action elle-même :
 * elles doivent s'évaluer même quand `entity` est `null` — sur la fiche commun AAC,
 * l'entité projet est résolue de façon asynchrone (`useCommunProjectEntity`) et vaut
 * `null` pendant tout le chargement, puis en cas d'échec. Seuls les droits qui
 * dépendent réellement d'un rôle sur l'entité (paliers, création d'action, `isAdmin`)
 * tombent alors à `false`, via `isAdmin`.
 *
 * Corollaire : un droit accordé ici ne dit PAS que la mutation peut aboutir. Les
 * mutations d'action exigent l'entité `Project` (`ActionMutationContext.project`) ;
 * c'est à l'appelant de le vérifier au clic, par `useActionGuards().requireProjectEntity`
 * — la disponibilité n'est pas une permission, et ne se calcule pas ici (M41).
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

  if (!isConnected) {
    return {
      ...DEFAULT_CAGNOTTE_PERMISSIONS,
      isConnected,
      currentUserId,
      canContributeReason: "User not connected",
    };
  }

  const hasResourceContext = Boolean(entity) || isResourceOwner;

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
    canContribute: hasResourceContext && Boolean(resourceId) && hasActiveItems,
    canContributeReason:
      !hasResourceContext
        ? "No entity provided"
        : !resourceId
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
    canDeleteAction: (action) => {
      if (!action) return false;
      // Symétrique de `canEditAction` sur le statut : une action terminée est un fait
      // comptable (crédits, versements aux contributeurs), seul l'admin la défait.
      if (action.status === "done") return isAdmin;
      // L'auteur seulement, PAS les contributeurs assignés : supprimer est plus fort
      // que corriger. Aligne le front sur le garde backend (`Action.delete()` du SDK
      // autorise `isAuthorOrAdmin`), qui était jusqu'ici plus permissif que l'UI.
      return isAdmin || isUserAuthorOf(action);
    },
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
