import type { RouteObject } from "react-router";
import { SiteRenderer } from '@/components/SiteRenderer';
import type { SiteConfig } from "@/types/site";
import RootLayout from "@/RootLayout";
import ProfilePage from "@/pages/ProfilePage";
import type { QueryClient } from "@tanstack/react-query";
import type { LoaderFunctionArgs } from "react-router";
import { getBaseUrl } from "./constant/common";
import { initApi } from "./apiClient";

/**
 * Construit l'arborescence de routes pour React Router v7 à partir
 * de la configuration JSON ‹pages›. Le layout racine (<RootLayout/>)
 * entoure toutes les pages et fournit les providers globaux.
 */
export function buildRoutes(cfg: SiteConfig, queryClient?: QueryClient): RouteObject[] {
  // enfants = chaque page décrite dans cfg.pages
  const children: RouteObject[] = cfg.pages.map((p) => ({
    path: p.path.replace(/^\/+/, ""),   // "about" au lieu de "/about"
    element: <SiteRenderer />,            // le rendu piloté par JSON
    // loader: () => p,                  // ← active si besoin des données coté client
  }));
  children.push({
    path: ":slug",
    element: <ProfilePage />,
    loader: async ({ params }: LoaderFunctionArgs) => {
      // Si pas de queryClient (côté client), on skip le pre-fetch
      if (!queryClient) return null;

      // Nettoyer le slug (enlever le @ si présent)
      const rawSlug = params.slug;
      const slug = rawSlug?.startsWith('@') ? rawSlug.slice(1) : rawSlug;

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
  });

  // route 404 interne (dernier recours)
  children.push({ path: "*", element: <SiteRenderer /> });

  // route root qui encapsule tout avec RootLayout
  return [
    {
      path: "/",              // correspond à la racine du site
      element: <RootLayout config={cfg} />,  // ThemeProvider + Providers + <Outlet/>
      children,
    },
  ];
}

