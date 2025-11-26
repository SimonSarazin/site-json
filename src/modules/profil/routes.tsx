import type { RouteObject } from "react-router";
import type { QueryClient } from "@tanstack/react-query";
import type { LoaderFunctionArgs } from "react-router";
import ProfilePage from "./pages/ProfilePage";
import { getBaseUrl } from "@/lib/constant/common";
import { initApi } from "@/lib/apiClient";
import type { ModuleRouteFactory } from "@/lib/modules";
import type { SiteConfig } from "@/types/site-schema";
import type { ProfileTabSubRoute } from "./schema";

/**
 * Types d'entités supportant les actualités
 */
const NEWS_SUPPORTED_TYPES = new Set(["organizations", "projects", "citoyens"]);

/**
 * Loader pour le profil principal
 * Pré-charge les données de l'entité côté serveur
 * Détecte le tab actif et pré-charge ses données si nécessaire
 */
const profileLoader = async (
  { params, request }: LoaderFunctionArgs,
  queryClient?: QueryClient,
  config?: SiteConfig
) => {
  // Si pas de queryClient (côté client), on skip le pre-fetch
  if (!queryClient) return null;

  const slug = params.slug;
  if (!slug) {
    throw new Response('Not Found', { status: 404 });
  }

  // Détecter le tab actif depuis l'URL
  const url = new URL(request.url);
  const pathSegments = url.pathname.split('/').filter(Boolean);
  const activeTab = pathSegments.length > 2 ? pathSegments[2] : 'about';

  try {
    // 1. Pré-charger les données du profil côté serveur
    const entity = await queryClient.ensureQueryData({
      queryKey: ["element-about", slug],
      queryFn: async () => {
        const { entity } = await initApi({
          baseURL: getBaseUrl(),
          debug: true
        });
        if (!entity) {
          throw new Error("API non initialisée");
        }
        return entity.entityBySlug(slug);
      }
    });

    // 2. Pré-charger les données du tab actif selon sa configuration
    if (entity && config && config.profiles) {
      const entityType = entity.getEntityType?.() || "";
      const profileConfig = config.profiles[entityType as keyof typeof config.profiles];

      if (profileConfig?.tabs) {
        const tabConfig = profileConfig.tabs.find((tab: any) => tab.id === activeTab);

        // Pré-charger selon les sections du tab
        if (tabConfig?.sections && NEWS_SUPPORTED_TYPES.has(entityType)) {
          // Vérifier s'il y a des sections de type "news"
          const hasNewsSection = tabConfig.sections.some((section: any) =>
            section.type === 'news'
          );

          if (hasNewsSection) {
            await queryClient.prefetchInfiniteQuery({
              queryKey: ["news", entity.id],
              queryFn: async () => {
                return entity.getNews({
                  indexStep: 12,
                  // Pas de dateLimit pour la première page
                });
              },
              initialPageParam: undefined,
            });
          }
        }

        // Pré-charger selon le component du tab (legacy support)
        if (tabConfig?.component === 'NewsTab' && NEWS_SUPPORTED_TYPES.has(entityType)) {
          await queryClient.prefetchInfiniteQuery({
            queryKey: ["news", entity.id],
            queryFn: async () => {
              return entity.getNews({
                indexStep: 12,
                // Pas de dateLimit pour la première page
              });
            },
            initialPageParam: undefined,
          });
        }
        // Ajouter d'autres pré-chargements ici selon les components
        // ex: SocialTab, MembershipTab, etc.
      }
    }

    return { entity, activeTab };
  } catch (error) {
    console.error('Erreur lors du chargement du profil:', error);
    throw new Response('Not Found', { status: 404 });
  }
};

/**
 * Génère les routes des tabs dynamiquement à partir de la config
 */
const generateTabRoutes = (config?: SiteConfig): RouteObject[] => {
  if (!config?.profiles) {
    return [{ index: true, element: null }];
  }

  // Collecter tous les tabs avec leurs sous-routes
  const tabsMap = new Map<string, { subRoutes?: ProfileTabSubRoute[] }>();

  Object.values(config.profiles).forEach(profileConfig => {
    if (profileConfig.tabs) {
      profileConfig.tabs.forEach(tab => {
        if (!tabsMap.has(tab.id)) {
          tabsMap.set(tab.id, { subRoutes: tab.subRoutes });
        } else {
          // Merger les subRoutes si le même tab existe dans plusieurs profils
          const existing = tabsMap.get(tab.id)!;
          if (tab.subRoutes && existing.subRoutes) {
            existing.subRoutes = [...existing.subRoutes, ...tab.subRoutes];
          } else if (tab.subRoutes) {
            existing.subRoutes = tab.subRoutes;
          }
        }
      });
    }
  });

  // Créer les routes pour chaque tab unique avec leurs sous-routes
  const tabRoutes: RouteObject[] = Array.from(tabsMap.entries()).map(([tabId, tabData]) => {
    const tabRoute: RouteObject = {
      path: tabId,
      element: null, // Le contenu sera rendu par ProfileTemplateDynamic
    };

    // Ajouter les sous-routes si elles existent
    if (tabData.subRoutes && tabData.subRoutes.length > 0) {
      tabRoute.children = tabData.subRoutes.map(subRoute => ({
        path: subRoute.path,
        element: null, // Sera rendu par TabDetailRenderer
      }));
    }

    return tabRoute;
  });

  // Ajouter la route index (par défaut)
  return [
    {
      index: true,
      element: null,
    },
    ...tabRoutes,
  ];
};

/**
 * Routes du module profil
 *
 * Ces routes sont dynamiquement générées à partir de la configuration JSON
 * via le système de découverte de modules (src/lib/modules.ts)
 *
 * Convention : /profil/:slug pour les profils
 * Routes imbriquées pour les tabs : /profil/:slug/{tabId}
 *
 * Les tabs disponibles sont déterminés par config.profiles[entityType].tabs
 *
 * @param queryClient - Client React Query pour le pré-chargement SSR
 * @param config - Configuration du site (optionnelle, pour SSR)
 * @returns Liste des routes du module profil
 */
export const routes: ModuleRouteFactory = (
  queryClient?: QueryClient,
  config?: SiteConfig
): RouteObject[] => [
  {
    path: "profil/:slug",
    element: <ProfilePage />,
    loader: (args) => profileLoader(args, queryClient, config),
    children: generateTabRoutes(config),
  }
];
