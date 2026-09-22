import { lazy } from "vite-preload";
import type { LoaderFunctionArgs, RouteObject } from "react-router";
import type { QueryClient } from "@tanstack/react-query";
import type { SiteConfig } from "@/types/site-schema";
import type { ModuleRouteFactory } from "@/lib/modules";
import { prefetchCommunDetail } from "./prefetch/prefetchCommun";

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
 *
 * Le `lazy` est celui de **`vite-preload`**, pas de React (CLAUDE.md) : lui seul
 * enregistre le chunk auprès du `ChunkCollectorContext`, ce qui donne les
 * `<link rel="modulepreload">` de la page ET le `preloadAll()` d'`entry-server`
 * — sans quoi le SSR ne rendait que le fallback de `Suspense`, et la fiche
 * n'existait qu'après hydratation.
 *
 * **Gate sur `config.aac`** : le module est `core`, donc découvert sur TOUS les
 * sites — sans ce gate, `/aac` et `/aac/commun/:answerId` étaient montées sur les
 * 16 sites sans AAC (vérifié par SSR sur `tiers-lieux`), où elles n'affichaient
 * qu'un « aucun AAC déclaré » et court-circuitaient le catch-all du site. Sans
 * `config.aac`, la factory rend `[]` : l'URL tombe sur le catch-all
 * (`buildRoutes.tsx`), comme n'importe quelle page inexistante. Précédent :
 * `auth/routes.tsx` gate `/recover/:user/:code` sur `config.auth.recover.mode`.
 */
const AacPage = lazy(() => import("./pages/AacPage"));
const AacCommunDetailPage = lazy(() => import("./pages/AacCommunDetailPage"));

/**
 * Préfetch SSR de la fiche d'un commun — c'est un lien partageable, son `<head>`
 * doit porter le titre, le résumé et l'image du commun dans la réponse HTTP.
 * Best-effort : un échec ne casse pas le rendu (la page refetche côté client).
 */
const communDetailLoader = async (
  { params }: LoaderFunctionArgs,
  queryClient?: QueryClient,
  config?: SiteConfig
) => {
  if (!queryClient) return null; // client → skip (la page fetche)
  const answerId = params.answerId;
  if (answerId) {
    try {
      await prefetchCommunDetail(queryClient, answerId, config?.aac?.formId ?? null);
    } catch {
      /* SSR best-effort */
    }
  }
  return null;
};

export const routes: ModuleRouteFactory = (queryClient, config): RouteObject[] => {
  if (!config?.aac) return [];
  return [
    {
      path: "/aac",
      element: <AacPage />,
    },
    {
      path: "/aac/commun/:answerId",
      element: <AacCommunDetailPage />,
      loader: (args) => communDetailLoader(args, queryClient, config),
    },
  ];
};
