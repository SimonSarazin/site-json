import { Suspense } from "react";
import { lazy } from "vite-preload";
import type { ModuleRouteFactory } from "@/lib/modules";
import { Spinner } from "@/components/ui/spinner";

/**
 * Paresseuse, et par `vite-preload` (CLAUDE.md) : importée en tête, la page tirait le panneau
 * entier dans le bundle INITIAL de tous les sites (revue du 29/09) — précédent : `aac/routes.tsx`.
 * Le `lazy` de `vite-preload` enregistre le chunk pour `preloadAll()` : le SSR rend la page, pas
 * le seul fallback. Celui-ci n'importe rien de la page, sans quoi il annulerait le `lazy`.
 */
const DiscussionsPage = lazy(() => import("./pages/DiscussionsPage"));

/**
 * Routes du module comment.
 *
 * Une seule : la vue plein écran du panneau. Le panneau contextuel, lui, se monte dans une
 * page existante — il n'a pas besoin de route, sa sélection vivant dans un paramètre d'URL.
 *
 * ⚠️ Le module reste `type: "core"` (voir `module.config.ts`). Déclarer des routes ne le
 * rend pas « optional » : `coform` fait exactement la même chose. Un seul module optional
 * suffirait à basculer toute la construction de routes en asynchrone, et à casser
 * l'hydratation de l'application entière.
 */
export const routes: ModuleRouteFactory = () => [
  {
    path: "discussions",
    element: (
      <Suspense fallback={<div className="flex min-h-[50vh] items-center justify-center" aria-busy="true"><Spinner className="size-8 text-primary" /></div>}>
        <DiscussionsPage />
      </Suspense>
    ),
  },
];
