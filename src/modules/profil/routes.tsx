import type { RouteObject } from "react-router";
import type { QueryClient } from "@tanstack/react-query";
import type { LoaderFunctionArgs } from "react-router";
import ProfilePage from "./pages/ProfilePage";
import { getBaseUrl } from "@/lib/constant/common";
import { initApi } from "@/lib/apiClient";
import type { ModuleRouteFactory } from "@/lib/modules";

/**
 * Routes du module profil
 *
 * Ces routes sont dynamiquement injectées dans le router principal
 * via le système de découverte de modules (src/lib/modules.ts)
 *
 * Convention : /profil/:slug correspond aux profils accessibles via /profil/username
 *
 * @param queryClient - Client React Query pour le pré-chargement SSR
 * @returns Liste des routes du module profil
 */
export const routes: ModuleRouteFactory = (queryClient?: QueryClient): RouteObject[] => [
  {
    path: "profil/:slug",
    element: <ProfilePage />,
    loader: async ({ params }: LoaderFunctionArgs) => {
      // Si pas de queryClient (côté client), on skip le pre-fetch
      if (!queryClient) return null;

      // Récupérer le slug directement (sans @ maintenant)
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
    }
  }
];
