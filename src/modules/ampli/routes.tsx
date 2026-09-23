import { QueryClient } from "@tanstack/react-query";
import { LoaderFunctionArgs, RouteObject } from "react-router";
import type { ModuleRouteFactory } from "@/lib/modules";
import type { SiteConfig } from "@/types/site-schema";
import AmpliPage from "./pages/AmpliPage";
import AmpliListPage from "./pages/AmpliListPage";
import { ampliSourceMode } from "./lib/costumAmpli";

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
 * Convention : /ampli/:slug pour une page ampli
 * Routes imbriquées pour les tabs : /ampli/:slug/:tab, etc.
 *
 * **Gate sur `config.ampli`** : le module est `core`, donc découvert sur TOUS
 * les sites — sans ce gate, `/ampli/:slug` était servi partout, avec une page
 * « ampli introuvable » à la place du catch-all du site. Précédent :
 * `aac/routes.tsx`.
 *  - `true` → `/ampli` (liste des amplis de `costum.ampli`) + `/ampli/:slug` ;
 *  - tableau (forme historique dépréciée) → `/ampli/:slug` SEUL, comme avant :
 *    la prod qui l'emploie ne gagne pas de page nouvelle ;
 *  - absent / `false` → aucune route.
 *
 * @param queryClient - Client React Query pour le pré-chargement SSR
 * @param config - Config du site (gate)
 * @returns Liste des routes du module ampli
 */
export const routes: ModuleRouteFactory = (queryClient?: QueryClient, config?: SiteConfig): RouteObject[] => {
    const mode = ampliSourceMode(config?.ampli);
    if (mode === "off") return [];

    const ampliRoute: RouteObject = {
        path: "ampli/:slug",
        element: <AmpliPage />,
        loader: (args) => ampliLoader(args, queryClient),
        children: [
            // Route index (par défaut) - Le contenu "home" est rendu directement dans AmpliPage
            {
                index: true,
                element: null, // Pas de composant séparé, le contenu est déjà dans le template
            },
            // Onglets : le rendu est géré par `AmpliSectionRenderer` (switch sur `activeTab`)
            {
                path: "community",
                element: null,
            },
            {
                path: "stats",
                element: null,
            },
            {
                path: "news",
                element: null,
            }
        ],
    };

    if (mode === "legacy") return [ampliRoute];

    return [
        {
            path: "ampli",
            element: <AmpliListPage />,
        },
        ampliRoute,
    ];
};
