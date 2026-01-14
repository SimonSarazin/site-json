/**
 * Hook pour les permissions news uniquement
 * Plus léger que useUserPermissions (ne calcule pas les permissions profil)
 */
import type { EntityTypes, News } from "@communecter/cocolight-api-client";
import { usePermissions } from "@/lib/permissions";
import type { NewsPermissions } from "../permissions";

// Import pour déclencher l'enregistrement du calculateur
import "../permissions/register";

/**
 * Hook local pour les permissions du module news
 *
 * Utilise directement le namespace "news" sans calculer les permissions profil.
 * Plus performant que useUserPermissions pour les composants du module news.
 *
 * @param entity - L'entité concernée (User, Organization, Project, Event)
 * @param news - La news concernée (optionnel, pour canEditNews/canDeleteNews)
 * @returns Permissions news calculées
 *
 * @example
 * const { canAddNews, canEditNews, canModerateNews } = useNewsPermissions(entity, news);
 */
export function useNewsPermissions(
  entity: EntityTypes | null,
  news?: News | null
): NewsPermissions {
  const { news: permissions } = usePermissions<{ news: NewsPermissions }>(
    ["news"],
    entity,
    { news }
  );
  return permissions;
}
