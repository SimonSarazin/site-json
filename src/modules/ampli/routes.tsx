import { useSite } from "@/hooks/useSite";
import { QueryClient } from "@tanstack/react-query";
import { LoaderFunctionArgs, RouteObject } from "react-router";
import type { ModuleRouteFactory } from "@/lib/modules";
import AmpliPage from "./pages/AmpliPage";

const ampliLoader = async ({ params, request }: LoaderFunctionArgs, queryClient?: QueryClient) => {
    if (!queryClient) return null;

    const slug = params.slug;
    if (!slug) {
        throw new Response("Not Found", { status: 404 })
    }
    const url = new URL(request.url);
    const pathSegments = url.pathname.split('/').filter(Boolean);
    const activeTab = pathSegments.length > 2 ? pathSegments[2] : 'home';

    try {
        return {
            slug,
            activeTab
        }
    } catch (error) {
        console.error('Erreur lors du chargement du profil:', error);
        throw new Response('Not Found', { status: 404 });
    }

}

/**
 * Routes du module ampli
 *
 * Ces routes sont dynamiquement injectées dans le router principal
 * via le système de découverte de modules (src/lib/modules.ts)
 *
 * Convention : /ampli/:slug pour les profils
 * Routes imbriquées pour les tabs : /ampli/:slug/:tab, etc.
 *
 * @param queryClient - Client React Query pour le pré-chargement SSR
 * @returns Liste des routes du module ampli
 */
export const routes: ModuleRouteFactory = (queryClient?: QueryClient): RouteObject[] => [
    {
        path: "ampli/:slug",
        element: <AmpliPage />,
        loader: (args) => ampliLoader(args, queryClient),
        children: [
            // Route index (par défaut) - Le contenu "home" est rendu directement dans AmpliPage
            {
                index: true,
                element: null, // Pas de composant séparé, le contenu est déjà dans le template
            },
            // Route pour le tab news
            {
                path: "community",
                element: null, // Le contenu sera rendu via LazyTabContent dans le template
            },
            // Route pour le tab coworking
            {
                path: "stats",
                element: null,
            },
            // Route pour le tab rooms
            {
                path: "news",
                element: null,
            }
        ],
    }
];