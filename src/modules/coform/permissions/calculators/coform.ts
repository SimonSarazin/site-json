/**
 * Calculateur de permissions coform.
 *
 * Sémantique :
 *  - `canSubmitAnswer` dérive d'`access.canAnswer` calculé côté backend
 *    (cf. `CoFormAccessInfo.canAnswer`). Si `access` n'est pas fourni, on retombe
 *    sur une approximation : connecté + non déjà répondu.
 *  - `canEditAnswer` : utilise `answer.canEdit` (calculé serveur) en priorité,
 *    sinon vérifie que `me.id === answer.user` ou que la réponse est en brouillon.
 *  - `canDeleteAnswer` : règle stricte — seul l'auteur peut supprimer sa réponse
 *    en l'absence de feature admin côté backend.
 *  - `canViewForm` : true sauf si `isOnlyMember` ET `me` n'est pas membre de l'entité.
 */
import type { EntityTypes, User } from "@communecter/cocolight-api-client";
import type {
  CoFormAnswerLike,
  CoFormPermissionData,
  CoFormPermissions,
} from "../types";
import { DEFAULT_COFORM_PERMISSIONS } from "../defaults";

type EntityWithMembership = EntityTypes & {
  isMember?: () => boolean;
};

function safeIsMember(entity: EntityTypes | null | undefined): boolean {
  if (!entity) return false;
  const e = entity as EntityWithMembership;
  try {
    return typeof e.isMember === "function" ? Boolean(e.isMember()) : false;
  } catch {
    return false;
  }
}

export function calculateCoFormPermissions(
  entity: EntityTypes | null,
  me: User | null,
  data?: CoFormPermissionData,
): CoFormPermissions {
  const isConnected = Boolean(me?.isConnected);
  const currentUserId = me?.id?.trim() || "";
  const isMember = safeIsMember(entity);
  const access = data?.access ?? null;

  // Cas dégradé : pas d'`access` côté serveur — on retourne les defaults sécurisés.
  if (!access) {
    return {
      ...DEFAULT_COFORM_PERMISSIONS,
      isConnected,
      isMember,
      currentUserId,
      canSubmitAnswer: false,
      cannotSubmitReason: isConnected ? null : "not_logged_in",
    };
  }

  // `access.canAnswer` est la source de vérité côté backend.
  const canSubmitAnswer = Boolean(access.canAnswer);
  const cannotSubmitReason = canSubmitAnswer ? undefined : access.reason;

  // `canViewForm` : restreint si `isOnlyMember` ET l'utilisateur n'est pas membre.
  const canViewForm = access.isOnlyMember ? isMember : true;

  // Helpers de calcul par-réponse.
  const isOwner = (answer: CoFormAnswerLike | null | undefined): boolean => {
    if (!answer || !currentUserId) return false;
    return Boolean(answer.user && answer.user === currentUserId);
  };

  const canEditAnswer = (answer: CoFormAnswerLike | null | undefined): boolean => {
    if (!answer || !isConnected) return false;
    // Le backend a déjà calculé le droit d'édition — confiance prioritaire.
    if (typeof answer.canEdit === "boolean") return answer.canEdit;
    // Fallback : brouillon de l'auteur courant.
    if (answer.draft && isOwner(answer)) return true;
    // Fallback final : l'auteur peut éditer sa propre réponse finalisée.
    return isOwner(answer);
  };

  const canDeleteAnswer = (answer: CoFormAnswerLike | null | undefined): boolean => {
    if (!answer || !isConnected) return false;
    // Pour l'instant : seul l'auteur peut supprimer sa réponse.
    return isOwner(answer);
  };

  return {
    canSubmitAnswer,
    cannotSubmitReason,
    canEditAnswer,
    canDeleteAnswer,
    canViewForm,
    isConnected,
    isMember,
    currentUserId,
  };
}
