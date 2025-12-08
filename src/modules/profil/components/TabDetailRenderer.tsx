import { useMemo } from "react";
import { lazy } from "vite-preload";
import { useParams, useLocation } from "react-router";
import { useSite } from "@/hooks/useSite";
import { useProfileEntity } from "../hooks/useProfileEntity";
import type { EntityTypes } from "@communecter/cocolight-api-client";
import type { NewsSection } from "@/modules/news/schema";

// Lazy load des composants de détail
const NewsDetailPage = lazy(() => import("@/modules/news/components/NewsDetailPage"));

interface TabDetailRendererProps {
  tabId: string;
}

/**
 * Composant qui rend les pages de détail des tabs basées sur la configuration
 */
export function TabDetailRenderer({ tabId }: TabDetailRendererProps) {
  const { entity } = useProfileEntity();
  const { config } = useSite();
  const params = useParams();
  const location = useLocation();

  // Déterminer le composant à rendre basé sur la route actuelle
  const currentSubRoute = useMemo(() => {
    if (!config?.profiles || !entity) return null;

    const entityType = entity.getEntityType();
    const profileConfig = config.profiles[entityType as keyof typeof config.profiles];

    if (!profileConfig?.tabs) return null;

    // Trouver le tab correspondant
    const tab = profileConfig.tabs.find(t => t.id === tabId);
    if (!tab?.subRoutes) return null;

    // Analyser l'URL pour déterminer quelle sous-route correspond
    const pathSegments = location.pathname.split('/').filter(Boolean);
    const tabIndex = pathSegments.findIndex(segment => segment === tabId);

    if (tabIndex === -1 || tabIndex >= pathSegments.length - 1) return null;

    // La partie après le tabId correspond à la sous-route
    const subRoutePath = pathSegments.slice(tabIndex + 1).join('/');

    // Trouver la sous-route correspondante
    return tab.subRoutes.find(subRoute => {
      // Matcher les patterns avec paramètres (ex: ":newsId" match "123")
      const pattern = subRoute.path.replace(/:[^/]+/g, '[^/]+');
      const regex = new RegExp(`^${pattern}$`);
      return regex.test(subRoutePath);
    });
  }, [config, entity, tabId, location.pathname]);

  // Extraire la configuration de la section du tab parent
  const sectionProps = useMemo(() => {
    if (!config?.profiles || !entity) return null;

    const entityType = entity.getEntityType();
    const profileConfig = config.profiles[entityType as keyof typeof config.profiles];
    const tab = profileConfig?.tabs?.find(t => t.id === tabId);

    if (!tab?.sections) return null;

    // Chercher une section de type "news" dans ce tab
    const newsSection = tab.sections.find(section => section.type === 'news') as NewsSection;
    return newsSection?.props || null;
  }, [config, entity, tabId]);

  if (!currentSubRoute) {
    return null;
  }

  // Mapper les noms de composants vers leurs implémentations
  const componentMap: Record<string, React.ComponentType<{ params: Record<string, string | undefined>; entity: EntityTypes; sectionProps?: NewsSection["props"] }>> = {
    NewsDetailPage,
  };

  const Component = componentMap[currentSubRoute.component];

  if (!Component) {
    console.warn(`Component ${currentSubRoute.component} not found in TabDetailRenderer`);
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">
          Component "{currentSubRoute.component}" not implemented
        </p>
      </div>
    );
  }

  return <Component params={params} entity={entity} sectionProps={sectionProps || undefined} />;
}

export default TabDetailRenderer;