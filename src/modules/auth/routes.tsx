import type { RouteObject } from "react-router";
import type { ModuleRouteFactory } from "@/lib/modules";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import RecoverPasswordPage from "./pages/RecoverPasswordPage";

/**
 * Routes du module auth, injectées dans le router via la découverte de modules
 * (`src/lib/modules.ts`). Fournit les pages auth pour tous les sites — plus
 * besoin de les redéclarer dans chaque config JSON.
 *
 * - /login
 * - /register
 * - /recover-password
 */
export const routes: ModuleRouteFactory = (): RouteObject[] => [
  { path: "login", element: <LoginPage /> },
  { path: "register", element: <RegisterPage /> },
  { path: "recover-password", element: <RecoverPasswordPage /> },
];
