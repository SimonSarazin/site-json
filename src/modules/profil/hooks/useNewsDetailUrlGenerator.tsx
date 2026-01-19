import { useMemo } from "react";
import { useSite } from "@/hooks/useSite";
import type { EntityTypes } from "@communecter/cocolight-api-client";

/**
 * Hook pour générer les URLs de détail des news dans le contexte profil
 * Découvre dynamiquement la configuration des tabs et subRoutes
 */
export function useNewsDetailUrlGenerator(entity: EntityTypes | null | undefined):
  ((newsId: string) => string | null) | null {

  const { config } = useSite();

  return useMemo(() => {
    if (!entity || !config?.profiles) return null;

    const entityType = entity.getEntityType();
    const profileConfig = config.profiles[entityType as keyof typeof config.profiles];

    if (!profileConfig?.tabs) return null;

    // Chercher le tab qui contient une section news avec subRoutes
    const newsTab = profileConfig.tabs.find(tab => {
      if (!tab.sections || !tab.subRoutes) return false;

      // Vérifier qu'il y a une section de type "news"
      const hasNewsSection = tab.sections.some(section => section.type === 'news');

      // Vérifier qu'il y a une subRoute qui pourrait être pour les news
      const hasNewsSubRoute = tab.subRoutes.some(subRoute =>
        subRoute.component === 'NewsDetailPage' || subRoute.path.includes('newsId')
      );

      return hasNewsSection && hasNewsSubRoute;
    });

    if (!newsTab) return null;

    // Déterminer le path du tab (utiliser tab.path ou tab.id)
    const tabPath = newsTab.path || newsTab.id;

    // Trouver la subRoute appropriée (première qui correspond à NewsDetailPage)
    const newsSubRoute = newsTab.subRoutes?.find(subRoute =>
      subRoute.component === 'NewsDetailPage' || subRoute.path.includes('newsId')
    );

    if (!newsSubRoute) return null;

    // Retourner la fonction générateur d'URL
    return (newsId: string): string | null => {
      if (!entity.slug || !newsId) return null;

      // Construire l'URL : /profil/:slug/:tabPath/:newsId
      // Le pattern ":newsId" est remplacé par la vraie valeur
      const subPath = newsSubRoute.path.replace(':newsId', newsId);
      return `/profil/${entity.slug}/${tabPath}/${subPath}`;
    };

  }, [entity, config]);
}