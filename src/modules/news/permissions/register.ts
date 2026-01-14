/**
 * Enregistrement des permissions du module news
 * Ce fichier doit être importé pour que les permissions soient disponibles
 */
import { registerPermissions } from "@/lib/permissions";
import type { PermissionContext } from "@/lib/permissions";
import { isUser } from "@/lib/getTypedEntity";
import type { News } from "@communecter/cocolight-api-client";
import type { NewsPermissions } from "./types";
import { DEFAULT_NEWS_PERMISSIONS } from "./defaults";
import { calculateNewsPermissions } from "./calculators/news";

/**
 * Calcule les permissions news
 */
function calculatePermissions(ctx: PermissionContext): NewsPermissions {
  const { entity, me, data } = ctx;
  const news = data?.news as News | undefined;

  // Si pas d'entité ou pas connectée
  if (!entity?.isConnected) {
    return DEFAULT_NEWS_PERMISSIONS;
  }

  // Si pas connecté
  if (!me?.isConnected) {
    return DEFAULT_NEWS_PERMISSIONS;
  }

  // Pour son propre profil, pas besoin de userContext
  const isOwnProfile = isUser(entity) && me.slug === entity.slug;
  if (!isOwnProfile && !entity?.userContext) {
    return DEFAULT_NEWS_PERMISSIONS;
  }

  return calculateNewsPermissions({
    entity,
    news,
    isOwnProfile,
  });
}

// Enregistrement dans le registry
registerPermissions<NewsPermissions>({
  namespace: "news",
  calculate: calculatePermissions,
});
