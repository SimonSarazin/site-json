import { useMemo } from "react";
import { useCocolight } from "@/hooks/useCocolight";
import type { EntityTypes, News} from "@communecter/cocolight-api-client";
import { isEvent, isOrganization, isProject, isUser } from "@/lib/getTypedEntity";

/**
 * Interface pour les permissions calculées
 */
export interface UserPermissions {
  // Permissions de profil
  canEditProfile: boolean;
  editProfileReason?: string;

  // Permissions de news
  canAddNews: boolean;
  canEditNews: boolean;
  canDeleteNews: boolean;
  canModerateNews: boolean;

  // Permissions de commentaires
  canEditComment: boolean;
  canDeleteComment: boolean;
}

/**
 * Hook centralisé pour calculer TOUTES les permissions d'un utilisateur sur une entité
 * Inclut les permissions de profil, news et commentaires
 *
 * @param entity - L'entité concernée (User, Organization, Project, Event, etc.)
 * @param news - La news concernée (optionnel, pour vérifier si l'utilisateur peut éditer/supprimer)
 * @returns Objet contenant toutes les permissions calculées
 *
 * @example
 * const { canEditProfile, canAddNews, canModerateNews } = useUserPermissions(entity);
 * if (canEditProfile) {
 *   // Afficher le bouton d'édition du profil
 * }
 */
export function useUserPermissions(
  entity: EntityTypes | null,
  news?: News | null
): UserPermissions {
  const { me } = useCocolight();

  return useMemo(() => {
    // Par défaut, aucune permission
    const defaultPermissions: UserPermissions = {
      canEditProfile: false,
      editProfileReason: "No entity provided",
      canAddNews: false,
      canEditNews: false,
      canDeleteNews: false,
      canModerateNews: false,
      canEditComment: false,
      canDeleteComment: false,
    };

    // Si pas d'entité
    if (!entity) {
      return defaultPermissions;
    }

    // Si pas connecté
    if (!me?.isConnected) {
      return {
        ...defaultPermissions,
        editProfileReason: "User not connected",
      };
    }

    // CAS 1: Profil de l'utilisateur connecté
    if (isUser(entity) && me.slug === entity.slug) {
      // Vérifier si l'utilisateur est l'auteur de la news
      const isNewsAuthor = news?.isAuthor() ?? false;

      return {
        canEditProfile: true, // Peut éditer son propre profil
        canAddNews: true, // Peut publier sur son propre profil
        canEditNews: isNewsAuthor, // Peut éditer ses propres news
        canDeleteNews: isNewsAuthor, // Peut supprimer ses propres news
        canModerateNews: true, // Peut modérer son propre profil (supprimer tous les commentaires)
        canEditComment: true, // Géré au niveau du commentaire individuel
        canDeleteComment: true, // Géré au niveau du commentaire individuel
      };
    }

    // CAS 2: Profil d'un autre utilisateur
    if (isUser(entity)) {
      return {
        canEditProfile: false, // Ne peut pas éditer le profil d'autrui
        editProfileReason: "Can only edit own profile",
        canAddNews: false, // Ne peut pas publier sur le profil d'autrui
        canEditNews: false, // Ne peut pas éditer les news d'autrui
        canDeleteNews: false, // Ne peut pas supprimer les news d'autrui
        canModerateNews: false, // Ne peut pas modérer le profil d'autrui
        canEditComment: true, // Peut éditer ses propres commentaires (vérifié ailleurs)
        canDeleteComment: false, // Ne peut supprimer que ses propres commentaires (vérifié ailleurs)
      };
    }

    // CAS 3: Organization
    if (isOrganization(entity)) {
      const isOrgAdminOrAuthor = entity.isAuthorOrAdmin();
      const isOrgMember = entity.isMember();
      const isNewsAuthor = news?.isAuthor() ?? false;

      return {
        canEditProfile: isOrgAdminOrAuthor, // Admin ou auteur peuvent éditer le profil
        editProfileReason: isOrgAdminOrAuthor ? undefined : "Must be admin or author of organization",
        canAddNews: isOrgAdminOrAuthor || isOrgMember, // Admins + Membres peuvent publier
        canEditNews: isNewsAuthor || isOrgAdminOrAuthor, // Auteur de la news OU Admin de l'orga
        canDeleteNews: isNewsAuthor || isOrgAdminOrAuthor, // Auteur de la news OU Admin de l'orga
        canModerateNews: isOrgAdminOrAuthor, // Admins seulement peuvent modérer
        canEditComment: true, // Vérifié au niveau du commentaire individuel
        canDeleteComment: true, // Vérifié au niveau du commentaire individuel
      };
    }

    // CAS 4: Project
    if (isProject(entity)) {
      const isProjectAdmin = entity.isAdmin();
      const isProjectContributor = entity.isContributor();
      const isNewsAuthor = news?.isAuthor() ?? false;

      return {
        canEditProfile: isProjectAdmin, // Seulement les admins peuvent éditer le profil du projet
        editProfileReason: isProjectAdmin ? undefined : "Must be admin of project",
        canAddNews: isProjectAdmin || isProjectContributor, // Admins + Contributeurs peuvent publier
        canEditNews: isNewsAuthor || isProjectAdmin, // Auteur de la news OU Admin du projet
        canDeleteNews: isNewsAuthor || isProjectAdmin, // Auteur de la news OU Admin du projet
        canModerateNews: isProjectAdmin, // Admins seulement peuvent modérer
        canEditComment: true, // Vérifié au niveau du commentaire individuel
        canDeleteComment: true, // Vérifié au niveau du commentaire individuel
      };
    }

    // CAS 5: Event
    if (isEvent(entity)) {
      const isEventAuthor = entity.isAuthor();
      const isNewsAuthor = news?.isAuthor() ?? false;

      return {
        canEditProfile: isEventAuthor, // Seulement l'auteur peut éditer l'événement
        editProfileReason: isEventAuthor ? undefined : "Must be author of event",
        canAddNews: isEventAuthor, // Seulement l'auteur de l'événement peut publier
        canEditNews: isNewsAuthor || isEventAuthor, // Auteur de la news OU Auteur de l'événement
        canDeleteNews: isNewsAuthor || isEventAuthor, // Auteur de la news OU Auteur de l'événement
        canModerateNews: isEventAuthor, // Seulement l'auteur de l'événement peut modérer
        canEditComment: true, // Vérifié au niveau du commentaire individuel
        canDeleteComment: true, // Vérifié au niveau du commentaire individuel
      };
    }

    // Aucune autre entité supportée pour le moment
    return {
      ...defaultPermissions,
      editProfileReason: "Entity type not supported for editing",
    };
  }, [entity, me, news]);
}
