/**
 * Calculateur de permissions news selon le type d'entité
 */
import type { EntityTypes, News } from "@communecter/cocolight-api-client";
import { isUser, isOrganization, isProject, isEvent } from "@/lib/getTypedEntity";
import type { NewsPermissions } from "../types";

interface CalculateNewsPermissionsOptions {
  entity: EntityTypes;
  news?: News | null;
  isOwnProfile: boolean;
}

/**
 * Calcule les permissions news pour une entité
 */
export function calculateNewsPermissions({
  entity,
  news,
  isOwnProfile,
}: CalculateNewsPermissionsOptions): NewsPermissions {
  const isNewsAuthor = news?.isAuthor() ?? false;

  // CAS 1: Son propre profil
  if (isOwnProfile) {
    return {
      canAddNews: true,
      canEditNews: isNewsAuthor,
      canDeleteNews: isNewsAuthor,
      canModerateNews: true,
      canEditComment: true,
      canDeleteComment: true,
    };
  }

  // CAS 2: Profil d'un autre utilisateur
  if (isUser(entity)) {
    return {
      canAddNews: false,
      canEditNews: false,
      canDeleteNews: false,
      canModerateNews: false,
      canEditComment: true, // Peut éditer ses propres commentaires
      canDeleteComment: false,
    };
  }

  // CAS 3: Organisation
  if (isOrganization(entity)) {
    const isOrgAdmin = entity.isAdmin();
    const isOrgMember = entity.isMember();

    return {
      canAddNews: isOrgAdmin || isOrgMember,
      canEditNews: isNewsAuthor || isOrgAdmin,
      canDeleteNews: isNewsAuthor || isOrgAdmin,
      canModerateNews: isOrgAdmin,
      canEditComment: true,
      canDeleteComment: true,
    };
  }

  // CAS 4: Projet
  if (isProject(entity)) {
    const isProjectAdmin = entity.isAdmin?.() ?? false;
    const isProjectContributor = entity.isContributor?.() ?? false;

    return {
      canAddNews: isProjectAdmin || isProjectContributor,
      canEditNews: isNewsAuthor || isProjectAdmin,
      canDeleteNews: isNewsAuthor || isProjectAdmin,
      canModerateNews: isProjectAdmin,
      canEditComment: true,
      canDeleteComment: true,
    };
  }

  // CAS 5: Événement
  if (isEvent(entity)) {
    const isAdmin = entity.isAdmin?.({ checkHierarchy: true }) ?? false;
    const isEventAuthor = entity.isAuthor?.() ?? false;
    const isOrgAdminOrAuthor = isAdmin || isEventAuthor;

    return {
      canAddNews: isOrgAdminOrAuthor,
      canEditNews: isNewsAuthor || isOrgAdminOrAuthor,
      canDeleteNews: isNewsAuthor || isOrgAdminOrAuthor,
      canModerateNews: isOrgAdminOrAuthor,
      canEditComment: true,
      canDeleteComment: true,
    };
  }

  // Par défaut (POI, etc.)
  return {
    canAddNews: false,
    canEditNews: false,
    canDeleteNews: false,
    canModerateNews: false,
    canEditComment: false,
    canDeleteComment: false,
  };
}
