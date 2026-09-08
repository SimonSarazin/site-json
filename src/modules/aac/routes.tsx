import { lazy } from "react";
import type { RouteObject } from "react-router";
import type { ModuleRouteFactory } from "@/lib/modules";

/**
 * Routes du module AAC (injectées dans le router principal via `discoverModules`).
 *
 * Convention : `/aac` — **un seul AAC par site**, le formulaire vient de
 * `config.aac.formId` (pas de param d'URL).
 *
 * Chargées en `lazy()`, contrairement à la version d'origine qui les importait
 * statiquement : la fiche détail et ses composants pèsent ~3 100 lignes et tirent
 * derrière eux les dialogues et mutations de cagnotte. Importés en tête, ils
 * partaient dans le bundle principal — donc chez les 16 sites du parc qui n'ont pas
 * d'AAC. Le `<Suspense>` qui les couvre est celui de `RootLayout.tsx:96`, et le
 * module suit ainsi la convention déjà tenue par `SectionRenderer` pour les sections.
 */
const AacPage = lazy(() => import("./pages/AacPage"));
const AacCommunDetailPage = lazy(() => import("./pages/AacCommunDetailPage"));

export const routes: ModuleRouteFactory = (): RouteObject[] => [
  {
    path: "/aac",
    element: <AacPage />,
  },
  {
    path: "/aac/commun/:answerId",
    element: <AacCommunDetailPage />,
  },
];
