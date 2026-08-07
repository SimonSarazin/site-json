import type { RouteObject } from "react-router";
import type { ModuleRouteFactory } from "@/lib/modules";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import RecoverPasswordPage from "./pages/RecoverPasswordPage";
import ActivateAccountPage from "./pages/ActivateAccountPage";

/**
 * Routes du module auth, injectées dans le router via la découverte de modules
 * (`src/lib/modules.ts`). Fournit les pages auth pour tous les sites — plus
 * besoin de les redéclarer dans chaque config JSON.
 *
 * - /login
 * - /register
 * - /recover-password
 * - /validate/:user/:validationKey        (liens du backend Node)
 * - /co2/person/activate/user/:user/validationKey/:validationKey/*  (liens LEGACY)
 *
 * Les deux formes de liens de validation sont servies pour que les e-mails DÉJÀ
 * ENVOYÉS restent valides quand le domaine d'un costum pointe sur site-json
 * (cf. cocolight-backend/docs/23-EMAILS-LIENS-ACTIVATION.md). Le splat de la
 * route legacy absorbe les suffixes Yii `/costum/true`, `/redirect/…`,
 * `/toredirect/…`.
 */
export const routes: ModuleRouteFactory = (): RouteObject[] => [
  { path: "login", element: <LoginPage /> },
  { path: "register", element: <RegisterPage /> },
  { path: "recover-password", element: <RecoverPasswordPage /> },
  { path: "validate/:user/:validationKey?", element: <ActivateAccountPage /> },
  {
    path: "co2/person/activate/user/:user/validationKey/:validationKey/*",
    element: <ActivateAccountPage />,
  },
  {
    path: "co2/person/activate/user/:user/validationKey/:validationKey",
    element: <ActivateAccountPage />,
  },
];
