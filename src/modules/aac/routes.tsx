import type { RouteObject } from "react-router";
import type { ModuleRouteFactory } from "@/lib/modules";
import AacPage from "./pages/AacPage";
import AacCommunDetailPage from "./pages/AacCommunDetailPage";

/**
 * Routes du module AAC (injectées dans le router principal via `discoverModules`).
 *
 * Convention : `/aac` — **un seul AAC par site**, le formulaire vient de
 * `config.aac.formId` (pas de param d'URL). SOCLE : stub de config résolue ;
 * deviendra listing/fiche d'un commun aux phases suivantes.
 */
export const routes: ModuleRouteFactory = (): RouteObject[] => [
  {
    path: "aac",
    element: <AacPage />,
  },
  {
    path: "commun/:answerId",
    element: <AacCommunDetailPage />,
  },
];
