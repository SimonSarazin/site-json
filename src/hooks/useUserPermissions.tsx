import { useMemo } from "react";
import { useCocolight } from "@/hooks/useCocolight";
import type { EntityTypes, News} from "@communecter/cocolight-api-client";
import { isEvent, isOrganization, isProject, isUser, isPoi } from "@/lib/getTypedEntity";

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

  // Permissions de relations (follow/friend pour utilisateurs)
  canFollow: boolean;
  isFollowing: boolean;
  canSendFriendRequest: boolean;
  isFriend: boolean;

  // Permissions organisation
  canRequestMembership: boolean;
  isMember: boolean;
  isAdmin: boolean;

  // Permissions projets
  isContributor: boolean;
  canRequestContributor: boolean;
  canRequestProjectAdmin: boolean;

  // Permissions événements
  isAuthor: boolean;
  isParticipant: boolean;
  canParticipate: boolean;

  // Permissions d'ajout d'entités
  canAddOrganization: boolean;
  canAddProject: boolean;
  canAddEvent: boolean;
  canAddPoi: boolean;
}

/**
 * Hook centralisé pour calculer TOUTES les permissions d'un utilisateur sur une entité
 * Inclut les permissions de profil, news, commentaires et relations (follow/friend)
 *
 * @param entity - L'entité concernée (User, Organization, Project, Event, etc.)
 * @param news - La news concernée (optionnel, pour vérifier si l'utilisateur peut éditer/supprimer)
 * @returns Objet contenant toutes les permissions calculées
 *
 * @example
 * const { canEditProfile, canAddNews, canFollow, isFriend } = useUserPermissions(entity);
 * if (canEditProfile) {
 *   // Afficher le bouton d'édition du profil
 * }
 * if (canFollow) {
 *   // Afficher le bouton follow
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
      canFollow: false,
      isFollowing: false,
      canSendFriendRequest: false,
      isFriend: false,
      canRequestMembership: false,
      isMember: false,
      isAdmin: false,
      isContributor: false,
      canRequestContributor: false,
      canRequestProjectAdmin: false,
      isAuthor: false,
      isParticipant: false,
      canParticipate: false,
      canAddOrganization: false,
      canAddProject: false,
      canAddEvent: false,
      canAddPoi: false,
    };

    // Si pas d'entité
    if (!entity?.isConnected) {
      return defaultPermissions;
    }

    // Si pas connecté
    if (!me?.isConnected) {
      return {
        ...defaultPermissions,
        editProfileReason: "User not connected",
      };
    }

    // Pour son propre profil, pas besoin de userContext
    // Pour les autres entités, userContext est requis pour calculer les permissions
    const isOwnProfile = isUser(entity) && me.slug === entity.slug;
    if (!isOwnProfile && !entity?.userContext) {
      return defaultPermissions;
    }

    // CAS 1: Profil de l'utilisateur connecté
    if (isOwnProfile) {
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
        canFollow: false, // Ne peut pas se suivre soi-même
        isFollowing: false,
        canSendFriendRequest: false, // Ne peut pas s'envoyer de demande d'ami
        isFriend: false,
        canRequestMembership: false, // N/A pour son propre profil
        isMember: false,
        isAdmin: false,
        isContributor: false,
        canRequestContributor: false,
        canRequestProjectAdmin: false,
        isAuthor: false,
        isParticipant: false,
        canParticipate: false,
        // Peut créer toutes les entités depuis son propre profil
        canAddOrganization: true,
        canAddProject: true,
        canAddEvent: true,
        canAddPoi: true,
      };
    }

    // CAS 2: Profil d'un autre utilisateur
    if (isUser(entity)) {
      // Récupérer les statuts de relation
      const isFollowingUser = entity.isFollowing?.() ?? false;
      const isFriendWithUser = entity.isFriend?.() ?? false;

      return {
        canEditProfile: false, // Ne peut pas éditer le profil d'autrui
        editProfileReason: "Can only edit own profile",
        canAddNews: false, // Ne peut pas publier sur le profil d'autrui
        canEditNews: false, // Ne peut pas éditer les news d'autrui
        canDeleteNews: false, // Ne peut pas supprimer les news d'autrui
        canModerateNews: false, // Ne peut pas modérer le profil d'autrui
        canEditComment: true, // Peut éditer ses propres commentaires (vérifié ailleurs)
        canDeleteComment: false, // Ne peut supprimer que ses propres commentaires (vérifié ailleurs)
        canFollow: true, // Peut suivre un autre utilisateur
        isFollowing: isFollowingUser,
        canSendFriendRequest: true, // Peut envoyer une demande d'ami
        isFriend: isFriendWithUser,
        canRequestMembership: false, // N/A pour utilisateurs
        isMember: false,
        isAdmin: false,
        isContributor: false,
        canRequestContributor: false,
        canRequestProjectAdmin: false,
        isAuthor: false,
        isParticipant: false,
        canParticipate: false,
        // Ne peut pas créer d'entités sur le profil d'un autre utilisateur
        canAddOrganization: false,
        canAddProject: false,
        canAddEvent: false,
        canAddPoi: false,
      };
    }

    // CAS 3: Organization
    if (isOrganization(entity)) {
      const isOrgAdmin= entity.isAdmin();
      // const isOrgAuthor = entity.isAuthorOrAdmin();
      // const isOrgAdminOrAuthor = isOrgAdmin || isOrgAuthor;
      const isOrgMember = entity.isMember();
      const isNewsAuthor = news?.isAuthor() ?? false;
      const isFollowingOrg = entity.isFollowing?.() ?? false;

      return {
        canEditProfile: isOrgAdmin, // Admin ou auteur peuvent éditer le profil
        editProfileReason: isOrgAdmin ? undefined : "Must be admin of organization",
        canAddNews: isOrgAdmin || isOrgMember, // Admins + Membres peuvent publier
        canEditNews: isNewsAuthor || isOrgAdmin, // Auteur de la news OU Admin de l'orga
        canDeleteNews: isNewsAuthor || isOrgAdmin, // Auteur de la news OU Admin de l'orga
        canModerateNews: isOrgAdmin, // Admins seulement peuvent modérer
        canEditComment: true, // Vérifié au niveau du commentaire individuel
        canDeleteComment: true, // Vérifié au niveau du commentaire individuel
        canFollow: !isOrgAdmin, // Peut follow si pas admin/auteur (les membres peuvent follow)
        isFollowing: isFollowingOrg,
        canSendFriendRequest: false, // Pas de demandes d'ami pour les organisations
        isFriend: false,
        canRequestMembership: !isOrgAdmin && !isOrgMember, // Peut demander si pas déjà membre
        isMember: isOrgMember,
        isAdmin: isOrgAdmin,
        isContributor: false,
        canRequestContributor: false,
        canRequestProjectAdmin: false,
        isAuthor: false,
        isParticipant: false,
        canParticipate: false,
        // Admin ou membre peuvent créer des entités enfants
        canAddOrganization: false, // Pas de sous-organisation
        canAddProject: isOrgAdmin || isOrgMember,
        canAddEvent: isOrgAdmin || isOrgMember,
        canAddPoi: isOrgAdmin || isOrgMember,
      };
    }

    // CAS 4: Project
    if (isProject(entity)) {
      const isProjectAdmin = entity.isAdmin?.() ?? false;
      const isProjectContributor = entity.isContributor?.() ?? false;
      const isFollowingProject = entity.isFollowing?.() ?? false;
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
        canFollow: !isProjectAdmin && !isProjectContributor, // Peut suivre si pas déjà membre/admin
        isFollowing: isFollowingProject,
        canSendFriendRequest: false, // Pas de demandes d'ami pour les projets
        isFriend: false,
        canRequestMembership: false, // N/A pour projets (utilise canRequestContributor à la place)
        isMember: false, // N/A pour projets (utilise isContributor à la place)
        isAdmin: isProjectAdmin,
        isContributor: isProjectContributor,
        canRequestContributor: !isProjectAdmin && !isProjectContributor, // Peut demander si pas déjà contributeur/admin
        canRequestProjectAdmin: isProjectContributor && !isProjectAdmin, // Peut demander admin si contributeur mais pas encore admin
        isAuthor: false,
        isParticipant: false,
        canParticipate: false,
        // Admin ou contributeur peuvent créer des entités enfants
        canAddOrganization: false,
        canAddProject: false, // Pas de sous-projet
        canAddEvent: isProjectAdmin || isProjectContributor,
        canAddPoi: isProjectAdmin || isProjectContributor,
      };
    }

    // CAS 5: Event
    if (isEvent(entity)) {
      const isAdmin = entity.isAdmin?.({ checkHierarchy: true}) ?? false;
      const isEventAuthor = entity.isAuthor?.() ?? false;
      const isOrgAdminOrAuthor = isAdmin || isEventAuthor;
      const isEventParticipant = entity.isAttendee?.() ?? false;
      const isFollowingEvent = entity.isFollowing?.() ?? false;
      const isNewsAuthor = news?.isAuthor() ?? false;

      return {
        canEditProfile: isOrgAdminOrAuthor, // Seulement l'auteur peut éditer l'événement
        editProfileReason: isOrgAdminOrAuthor ? undefined : "Must be author of event",
        canAddNews: isOrgAdminOrAuthor, // Seulement l'auteur de l'événement peut publier
        canEditNews: isNewsAuthor || isOrgAdminOrAuthor, // Auteur de la news OU Auteur de l'événement
        canDeleteNews: isNewsAuthor || isOrgAdminOrAuthor, // Auteur de la news OU Auteur de l'événement
        canModerateNews: isOrgAdminOrAuthor, // Seulement l'auteur de l'événement peut modérer
        canEditComment: true, // Vérifié au niveau du commentaire individuel
        canDeleteComment: true, // Vérifié au niveau du commentaire individuel
        canFollow: true, // Peut suivre si pas l'auteur
        isFollowing: isFollowingEvent,
        canSendFriendRequest: false, // Pas de demandes d'ami pour les événements
        isFriend: false,
        canRequestMembership: false, // N/A pour événements (utilise canParticipate à la place)
        isMember: false, // N/A pour événements (utilise isParticipant à la place)
        isAdmin: false, // N/A pour événements (utilise isAuthor à la place)
        isContributor: false,
        canRequestContributor: false,
        canRequestProjectAdmin: false,
        isAuthor: isEventAuthor,
        isParticipant: isEventParticipant,
        canParticipate: !isEventParticipant, // Peut participer si pas déjà participant
        // Seulement l'auteur peut créer des POI sur un événement
        canAddOrganization: false,
        canAddProject: false,
        canAddEvent: false, // Pas de sous-événement (pour l'instant)
        canAddPoi: false,
      };
    }

    // CAS 6: POI (pas de news sur les POI)
    if (isPoi(entity)) {
      const isPoiAuthor = entity.isAuthor?.() ?? false;
      const isFollowingPoi = entity.isFollowing?.() ?? false;

      return {
        canEditProfile: isPoiAuthor, // Seulement l'auteur peut éditer le POI
        editProfileReason: isPoiAuthor ? undefined : "Must be author of POI",
        canAddNews: false, // Pas de news sur les POI
        canEditNews: false,
        canDeleteNews: false,
        canModerateNews: false,
        canEditComment: false, // Pas de commentaires sur les POI
        canDeleteComment: false,
        canFollow: !isPoiAuthor, // Peut suivre si pas l'auteur
        isFollowing: isFollowingPoi,
        canSendFriendRequest: false, // Pas de demandes d'ami pour les POI
        isFriend: false,
        canRequestMembership: false, // N/A pour POI
        isMember: false,
        isAdmin: false,
        isContributor: false,
        canRequestContributor: false,
        canRequestProjectAdmin: false,
        isAuthor: isPoiAuthor,
        isParticipant: false,
        canParticipate: false,
        // Pas de création d'entités enfants sur un POI
        canAddOrganization: false,
        canAddProject: false,
        canAddEvent: false,
        canAddPoi: false,
      };
    }

    // Aucune autre entité supportée pour le moment
    return {
      ...defaultPermissions,
      editProfileReason: "Entity type not supported for editing",
    };
  }, [entity, me, news]);
}