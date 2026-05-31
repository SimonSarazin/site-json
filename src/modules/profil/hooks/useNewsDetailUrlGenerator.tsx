import { useMemo } from "react";
import { useSite } from "@/hooks/useSite";
import type { EntityTypes } from "@communecter/cocolight-api-client";
import type { SiteConfig } from "@/types/site-schema";
import type { ProfileTab } from "../schema";

/**
 * Construit l'URL d'un onglet de profil (`/profil/:slug/:tabPath`) en cherchant,
 * dans la config du type d'entité, le premier onglet qui satisfait `match`. Pur
 * → réutilisable (ex. redirection des notifications selon le verbe). `null` si
 * l'entité/config ne permet pas de le construire ou si aucun onglet ne matche.
 */
export function buildProfileTabUrl(
  config: SiteConfig | null | undefined,
  entity: EntityTypes | null | undefined,
  match: (tab: ProfileTab) => boolean,
): string | null {
  if (!entity?.slug || !config?.profiles) return null;
  const entityType = entity.getEntityType();
  const profileConfig = config.profiles[entityType as keyof typeof config.profiles];
  const tab = profileConfig?.tabs?.find(match);
  if (!tab) return null;
  return `/profil/${entity.slug}/${tab.path || tab.id}`;
}

/**
 * Construit l'URL de détail d'une news (`/profil/:slug/:tabPath/:newsId`) en
 * découvrant dynamiquement, dans la config du site, le tab "journal" du type
 * d'entité (par capacité : section `news` + subRoute `NewsDetailPage`). Pur →
 * réutilisable hors composant (ex. redirection des notifications).
 *
 * @returns l'URL, ou `null` si l'entité/config ne permet pas de la construire.
 */
export function buildNewsDetailUrl(
  config: SiteConfig | null | undefined,
  entity: EntityTypes | null | undefined,
  newsId: string,
): string | null {
  if (!entity || !config?.profiles || !newsId) return null;

  const entityType = entity.getEntityType();
  const profileConfig = config.profiles[entityType as keyof typeof config.profiles];

  if (!profileConfig?.tabs) return null;

  // Chercher le tab qui contient une section news avec subRoutes
  const newsTab = profileConfig.tabs.find((tab) => {
    if (!tab.sections || !tab.subRoutes) return false;

    // Vérifier qu'il y a une section de type "news"
    const hasNewsSection = tab.sections.some((section) => section.type === "news");

    // Vérifier qu'il y a une subRoute qui pourrait être pour les news
    const hasNewsSubRoute = tab.subRoutes.some(
      (subRoute) =>
        subRoute.component === "NewsDetailPage" || subRoute.path.includes("newsId"),
    );

    return hasNewsSection && hasNewsSubRoute;
  });

  if (!newsTab) return null;

  // Déterminer le path du tab (utiliser tab.path ou tab.id)
  const tabPath = newsTab.path || newsTab.id;

  // Trouver la subRoute appropriée (première qui correspond à NewsDetailPage)
  const newsSubRoute = newsTab.subRoutes?.find(
    (subRoute) =>
      subRoute.component === "NewsDetailPage" || subRoute.path.includes("newsId"),
  );

  if (!newsSubRoute || !entity.slug) return null;

  // Le pattern ":newsId" est remplacé par la vraie valeur
  const subPath = newsSubRoute.path.replace(":newsId", newsId);
  return `/profil/${entity.slug}/${tabPath}/${subPath}`;
}

/**
 * Hook pour générer les URLs de détail des news dans le contexte profil
 * Découvre dynamiquement la configuration des tabs et subRoutes
 */
export function useNewsDetailUrlGenerator(entity: EntityTypes | null | undefined):
  ((newsId: string) => string | null) | null {

  const { config } = useSite();

  return useMemo(() => {
    if (!entity || !config?.profiles) return null;
    return (newsId: string): string | null => buildNewsDetailUrl(config, entity, newsId);
  }, [entity, config]);
}