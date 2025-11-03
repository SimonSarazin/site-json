import type { RouteObject } from "react-router";
import { SiteRenderer } from '@/components/SiteRenderer';
import type { SiteConfig } from "@/types/site";
import RootLayout from "@/RootLayout";
import ProfilePage from "@/pages/ProfilePage";

/**
 * Construit l'arborescence de routes pour React Router v7 à partir
 * de la configuration JSON ‹pages›. Le layout racine (<RootLayout/>)
 * entoure toutes les pages et fournit les providers globaux.
 */
export function buildRoutes(cfg: SiteConfig): RouteObject[] {
  // enfants = chaque page décrite dans cfg.pages
  const children: RouteObject[] = cfg.pages.map((p) => ({
    path: p.path.replace(/^\/+/, ""),   // "about" au lieu de "/about"
    element: <SiteRenderer />,            // le rendu piloté par JSON
    // loader: () => p,                  // ← active si besoin des données coté client
  }));
  children.push({
    path: ":slug",
    element: <ProfilePage />
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

