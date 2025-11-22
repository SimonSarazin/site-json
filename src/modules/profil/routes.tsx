import type { RouteObject } from "react-router";
import type { QueryClient } from "@tanstack/react-query";
import type { LoaderFunctionArgs } from "react-router";
import ProfilePage from "./pages/ProfilePage";
import { getBaseUrl } from "@/lib/constant/common";
import { initApi } from "@/lib/apiClient";
import type { ModuleRouteFactory } from "@/lib/modules";

/**
 * Types d'entités supportant les actualités
 */
const NEWS_SUPPORTED_TYPES = new Set(["organizations", "projects", "citoyens"]);

/**
 * Loader pour le profil principal
 * Pré-charge les données de l'entité côté serveur
 * Détecte le tab actif et pré-charge ses données si nécessaire
 */
const profileLoader = async ({ params, request }: LoaderFunctionArgs, queryClient?: QueryClient) => {
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

    // 2. Pré-charger les données du tab actif si nécessaire
    if (activeTab === 'news' && entity) {
      const entityType = entity.getEntityType?.() || "";

      // Vérifier si ce type d'entité supporte les actualités
      if (NEWS_SUPPORTED_TYPES.has(entityType)) {
        await queryClient.prefetchInfiniteQuery({
          queryKey: ["profile-news", entity.id],
          queryFn: async () => {
            return entity.getNews({
              indexStep: 12,
              dateLimit: Math.floor(Date.now() / 1000)
            });
          },
          initialPageParam: Math.floor(Date.now() / 1000),
        });
      }
    }

    return { entity, activeTab };
  } catch (error) {
    console.error('Erreur lors du chargement du profil:', error);
    throw new Response('Not Found', { status: 404 });
  }
};

/**
 * Routes du module profil
 *
 * Ces routes sont dynamiquement injectées dans le router principal
 * via le système de découverte de modules (src/lib/modules.ts)
 *
 * Convention : /profil/:slug pour les profils
 * Routes imbriquées pour les tabs : /profil/:slug/news, /profil/:slug/coworking, etc.
 *
 * @param queryClient - Client React Query pour le pré-chargement SSR
 * @returns Liste des routes du module profil
 */
export const routes: ModuleRouteFactory = (queryClient?: QueryClient): RouteObject[] => [
  {
    path: "profil/:slug",
    element: <ProfilePage />,
    loader: (args) => profileLoader(args, queryClient),
    children: [
      // Route index (par défaut) - Le contenu "about" est rendu directement dans ProfileTemplateDefault
      {
        index: true,
        element: null, // Pas de composant séparé, le contenu est déjà dans le template
      },
      // Route pour le tab news
      {
        path: "news",
        element: null, // Le contenu sera rendu via LazyTabContent dans le template
      },
      // Route pour le tab coworking
      {
        path: "coworking",
        element: null,
      },
      // Route pour le tab rooms
      {
        path: "rooms",
        element: null,
      },
      // Route pour le tab infos
      {
        path: "infos",
        element: null,
      },
      // Route pour le tab communities
      {
        path: "communities",
        element: null,
      },
      // Route pour le tab observatory
      {
        path: "observatory",
        element: null,
      },
    ],
  }
];
