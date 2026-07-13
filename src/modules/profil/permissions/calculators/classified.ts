/**
 * Calculateur de permissions pour les Classified (annonces / ressources)
 */
import type { Classified } from "@communecter/cocolight-api-client";
import type { ProfilPermissions } from "../types";

/**
 * Calcule les permissions pour un Classified.
 * Droit d'édition = auteur (créateur) OU admin via la hiérarchie parent (org/projet), aligné sur le POI
 * et sur le legacy `Authorisation::canEdit` (classifieds passent par la même branche que poi/cms).
 * NB : le droit-parapluie costum (admin du host, pour un classified SOURCÉ au costum SANS parent) est
 * ajouté génériquement par le dispatcher `register.ts` (ctx.isCostumAdmin + source.keys ∋ costumSlug).
 */
export function calculateClassifiedPermissions(entity: Classified): ProfilPermissions {
  const isAuthor = entity.isAuthor?.() ?? false;
  const isAdmin = entity.isAdmin?.({ checkHierarchy: true }) ?? false;
  const canEdit = isAuthor || isAdmin;
  const isFollowing = entity.isFollowing?.() ?? false;

  return {
    canEditProfile: canEdit,
    editProfileReason: canEdit ? undefined : "Must be author or admin of classified",
    canFollow: !canEdit,
    isFollowing,
    canSendFriendRequest: false,
    isFriend: false,
    canRequestMembership: false,
    canRequestOrganizationAdmin: false,
    isMember: false,
    isAdmin: false,
    isContributor: false,
    isToBeValidated: false,
    isInviting: false,
    isInvitingAdmin: false,
    isAdminPending: false,
    hasSentFriendRequest: false,
    hasReceivedFriendRequest: false,
    canRequestContributor: false,
    canRequestProjectAdmin: false,
    canRequestPromotion: false,
    isAuthor,
    isParticipant: false,
    canParticipate: false,
    canAddOrganization: false,
    canAddProject: false,
    canAddEvent: false,
    canAddPoi: false,
  };
}
