import { Suspense, type ComponentType, type ReactNode } from "react";
import { lazy } from "vite-preload";
import type { ModuleRouteFactory } from "@/lib/modules";
import { Spinner } from "@/components/ui/spinner";
import { actionsChildRoutes, type ActionsViewId } from "./lib/kanbanPaths";
// Garde les boîtes paresseuses du module dans ce chunk d'entrée (cf. `lazyDialogs.ts`).
import "./lazyDialogs";

/**
 * Pages paresseuses, par le `lazy` de `vite-preload` (CLAUDE.md) : lui seul enregistre le
 * chunk pour `preloadAll()`, ce qui fait rendre la page au serveur et non le seul fallback.
 * Importées en tête, elles partiraient dans le bundle initial de tous les sites.
 */
const KanbanHomePage = lazy(() => import("./pages/KanbanHomePage"));
const KanbanActionsPage = lazy(() => import("./pages/KanbanActionsPage"));
const KanbanRolesPage = lazy(() => import("./pages/KanbanRolesPage"));

/*
 * Les vues du tableau des actions, chacune dans son chunk : qui ouvre la Liste ne télécharge pas
 * dnd-kit, qui reste au Tableau ne télécharge pas la Chronologie. Déclarées ICI, dans le chunk
 * d'entrée, et non dans la page : un `import()` écrit dans le chunk d'une page lui fait perdre sa
 * façade de manifest (préflight `lazy-entry-facades`).
 */
const ACTIONS_VIEW_COMPONENTS: Record<ActionsViewId, ComponentType> = {
  overview: lazy(() => import("./components/actions/OverviewView")),
  kanban: lazy(() => import("./components/actions/ActionsBoardView")),
  milestones: lazy(() => import("./components/actions/MilestonesView")),
  list: lazy(() => import("./components/actions/ListView")),
  table: lazy(() => import("./components/actions/TableView")),
  timeline: lazy(() => import("./components/actions/TimelineView")),
};

/** Fallback LOCAL : il n'importe rien des pages, sans quoi il annulerait le `lazy`. */
function withFallback(element: ReactNode): ReactNode {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center" aria-busy="true">
          <Spinner className="size-8 text-primary" />
        </div>
      }
    >
      {element}
    </Suspense>
  );
}

/** Fallback d'une VUE, sous l'en-tête du tableau déjà affiché : un repère discret, pas une page d'attente. */
function withViewFallback(element: ReactNode): ReactNode {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-40 items-center justify-center" aria-busy="true">
          <Spinner className="size-6 text-primary" />
        </div>
      }
    >
      {element}
    </Suspense>
  );
}

/**
 * Routes du module kanban : `/kanban` (liste), `/kanban/actions` et ses vues (Tableau, Liste,
 * Table, Chronologie, Vue d'ensemble, Jalons), `/kanban/roles`.
 *
 * **Gate sur `config.kanban`** : le module est `core`, donc découvert sur TOUS les sites. Sans
 * ce gate, `/kanban` serait montée partout et court-circuiterait le catch-all du site (même
 * raison qu'`aac/routes.tsx`). Le porteur du site (organisation ou projet), lui, se vérifie
 * dans la page : la fabrique ne connaît que la config.
 */
export const routes: ModuleRouteFactory = (_queryClient, config) => {
  if (!config?.kanban) return [];
  return [
    { path: "kanban", element: withFallback(<KanbanHomePage />) },
    // La page est le PARENT des vues : son en-tête, son instantané et sa recherche restent montés
    // d'une vue à l'autre ; la vue courante se rend dans son `<Outlet>`.
    {
      path: "kanban/actions",
      element: withFallback(<KanbanActionsPage />),
      children: actionsChildRoutes((view) => {
        const View = ACTIONS_VIEW_COMPONENTS[view];
        return withViewFallback(<View />);
      }),
    },
    { path: "kanban/roles", element: withFallback(<KanbanRolesPage />) },
  ];
};
