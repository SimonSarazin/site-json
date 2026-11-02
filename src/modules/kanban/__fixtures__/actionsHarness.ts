/**
 * Harnais des tests du tableau des actions : la mise en page (`ActionsLayout`) montée sous les
 * MÊMES routes filles que `routes.tsx` (`actionsChildRoutes`), avec les vues importées
 * directement plutôt qu'à la demande. Un témoin affiche l'adresse courante.
 *
 * `createElement` et non du JSX : ce fichier reste un `.ts`, que la règle `react-refresh` (un
 * fichier `.tsx` n'exporte que des composants) ne vise pas.
 */
import { createElement, createRef, Fragment, type ComponentType, type RefObject } from "react";
import { render, screen } from "@testing-library/react";
import { createMemoryRouter, Outlet, RouterProvider, useLocation } from "react-router";
import ActionsBoardView from "@/modules/kanban/components/actions/ActionsBoardView";
import { ActionsLayout } from "@/modules/kanban/components/actions/ActionsLayout";
import ListView from "@/modules/kanban/components/actions/ListView";
import MilestonesView from "@/modules/kanban/components/actions/MilestonesView";
import OverviewView from "@/modules/kanban/components/actions/OverviewView";
import TableView from "@/modules/kanban/components/actions/TableView";
import TimelineView from "@/modules/kanban/components/actions/TimelineView";
import { actionsChildRoutes, type ActionsViewId } from "@/modules/kanban/lib/kanbanPaths";
import { hookWrapper, testQueryClient } from "./hookHarness";

const VIEWS: Record<ActionsViewId, ComponentType> = {
  overview: OverviewView,
  kanban: ActionsBoardView,
  milestones: MilestonesView,
  list: ListView,
  table: TableView,
  timeline: TimelineView,
};

function Temoin() {
  const { pathname } = useLocation();
  return createElement("p", { "data-testid": "chemin" }, pathname);
}

function Root({ titleRef }: { titleRef: RefObject<HTMLHeadingElement | null> }) {
  return createElement(Fragment, null, createElement(Temoin), createElement("h1", { ref: titleRef, tabIndex: -1 }, "Actions"), createElement(Outlet));
}

/** Monte le tableau des actions à `path` (`/kanban/actions/liste`…), sur le backend installé. */
export function mountActions(path: string, boardId = "b1") {
  const titleRef = createRef<HTMLHeadingElement>();
  const Wrapper = hookWrapper(testQueryClient());
  const router = createMemoryRouter(
    [
      {
        path: "/",
        element: createElement(Root, { titleRef }),
        children: [{ path: "kanban/actions", element: createElement(ActionsLayout, { boardId, titleRef }), children: actionsChildRoutes((view) => createElement(VIEWS[view])) }],
      },
    ],
    { initialEntries: [path] },
  );
  render(createElement(Wrapper, null, createElement(RouterProvider, { router })));
  return { titleRef, router };
}

/** Adresse courante, lue sur le témoin. */
export function currentPath(): string | null {
  return screen.getByTestId("chemin").textContent;
}
