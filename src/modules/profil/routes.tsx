import type { RouteObject } from "react-router";
import type { QueryClient } from "@tanstack/react-query";
import type { LoaderFunctionArgs } from "react-router";
import ProfilePage from "./pages/ProfilePage";
import { getBaseUrl } from "@/lib/constant/common";
import { initApi } from "@/lib/apiClient";
import type { ModuleRouteFactory } from "@/lib/modules";

/**
 * Loader pour le profil principal
 * Pré-charge les données de l'entité côté serveur
 */
const profileLoader = async ({ params }: LoaderFunctionArgs, queryClient?: QueryClient) => {
  // Si pas de queryClient (côté client), on skip le pre-fetch
  if (!queryClient) return null;

  const slug = params.slug;
  if (!slug) {
    throw new Response('Not Found', { status: 404 });
  }

  try {
    // Pré-charger les données du profil côté serveur
    return await queryClient.ensureQueryData({
      queryKey: ["element-about", slug],
      queryFn: async () => {
        const { organization } = await initApi({
          baseURL: getBaseUrl(),
          debug: true
        });
        if (!organization) {
          throw new Error("API non initialisée");
        }
        return organization.entityBySlug(slug);
      }
    });
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
