import type { ModuleRouteFactory } from "@/lib/modules";

import AdminPage from "./pages/AdminPage";

/**
 * Routes du module admin. Auto-découvertes par `discoverModules()` (import.meta.glob).
 * `admin/:section` sert le deep-link vers un onglet (résolu client-side par `AdminRenderer`).
 * Pas de loader SSR : client island (données permission-dépendantes).
 */
export const routes: ModuleRouteFactory = () => [
  { path: "admin", element: <AdminPage /> },
  { path: "admin/:section", element: <AdminPage /> },
];
