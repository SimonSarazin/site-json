/**
 * Hook rétrocompatible pour les permissions utilisateur
 *
 * Ce fichier est un wrapper qui agrège les permissions des modules profil et news.
 * Pour les nouveaux développements, préférer utiliser usePermissions directement
 * avec les namespaces spécifiques dont vous avez besoin.
 *
 * @example
 * // Usage existant (rétrocompatible)
 * const { canEditProfile, canAddNews } = useUserPermissions(entity);
 *
 * // Usage recommandé pour nouveaux développements
 * import { usePermissions } from "@/lib/permissions";
 * const { profil } = usePermissions<{ profil: ProfilPermissions }>(["profil"], entity);
 */
import type { EntityTypes, News } from "@communecter/cocolight-api-client";
import { usePermissions } from "@/lib/permissions";
import type { ProfilPermissions } from "@/modules/profil/permissions";
import type { NewsPermissions } from "@/modules/news/permissions";

// Import des registers pour déclencher l'enregistrement des calculateurs
import "@/modules/profil/permissions/register";
import "@/modules/news/permissions/register";

/**
 * Interface combinée pour rétrocompatibilité
 * Agrège ProfilPermissions + NewsPermissions
 */
export type UserPermissions = ProfilPermissions & NewsPermissions;

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
  // Utilise le système de permissions modulaire
  const permissions = usePermissions<{
    profil: ProfilPermissions;
    news: NewsPermissions;
  }>(["profil", "news"], entity, { news });

  // Flatten pour rétrocompatibilité avec l'ancienne API
  return {
    ...permissions.profil,
    ...permissions.news,
  };
}
