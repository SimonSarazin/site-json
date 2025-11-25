import type { RouteObject } from "react-router";
import type { ModuleRouteFactory } from "@/lib/modules";

/**
 * Routes du module News
 *
 * Fournit :
 * - /news - Liste des actualités
 * - /news/:id - Détail d'une actualité
 */
export const routes: ModuleRouteFactory = () => {
  const newsRoutes: RouteObject[] = [
    {
      path: "/news",
      lazy: () => import("./pages").then(m => ({ Component: m.NewsPage })),
    },
    {
      path: "/news/:id",
      lazy: () => import("./pages").then(m => ({ Component: m.NewsDetailPage })),
    },
  ];

  return newsRoutes;
};