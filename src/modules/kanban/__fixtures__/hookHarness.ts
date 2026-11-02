/**
 * Harnais des tests de HOOKS du module (`renderHook`) : session simulée, backend simulé route
 * par route, fournisseurs React. Repris de co-kanban (`tests/fixtures/hookHarness.tsx`), avec
 * la même interface (`signIn`, `stubKanbanFetch`, `hookWrapper`…) pour que ses tests se
 * reprennent tels quels.
 *
 * Différence : co-kanban remplaçait `fetch`. Ici, le backend simulé est le PONT du SDK
 * (`FakeBridge`), servi par le vrai transport (`createSdkKanbanClient`) : chaque test traverse
 * donc la traduction d'erreurs et le dépliage d'enveloppe du module.
 */
import "@/modules/kanban/i18n";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { MemoryRouter } from "react-router";
import { Toaster } from "sonner";
import { KanbanSessionContext, type KanbanSession } from "@/modules/kanban/hooks/useKanbanSession";
import { createSdkKanbanClient } from "@/modules/kanban/transport/sdkKanbanClient";
import { FakeBridge, FakeMainClient, type RouteHandler } from "./fakeSdk";

export { ok, refusal, type FakeResponse, type RouteHandler } from "./fakeSdk";

let currentUserId: string | null = null;
let bridge = new FakeBridge();

/** Ouvre une session : les hooks de données restent inertes sans utilisateur. */
export function signIn(userId = "u1"): void {
  currentUserId = userId;
}

/**
 * Remise à zéro après chaque test : arbre démonté, session, backend et stockage oubliés. Vitest n'expose
 * pas `afterEach` en global : chaque fichier l'appelle dans son `afterEach`.
 */
export function resetHarness(): void {
  cleanup();
  currentUserId = null;
  bridge = new FakeBridge();
  // Préférences du poste (colonnes masquées) : un test ne doit pas hériter de celles du précédent.
  if (typeof window !== "undefined") window.localStorage.clear();
}

export interface FakeKanban {
  /** Nombre d'appels reçus par une route (`board/sync`, `comment/list`…). */
  calls: (route: string) => number;
  /** Remplace la réponse d'une route pour les appels suivants. */
  on: (route: string, handler: RouteHandler) => void;
}

/**
 * Installe un backend simulé. Une route sans gestionnaire répond 404 `notFound` : un appel
 * inattendu se voit dans le test. Le nom est celui de co-kanban, gardé pour ses tests.
 */
export function stubKanbanFetch(routes: Record<string, RouteHandler>): FakeKanban {
  bridge = new FakeBridge(routes);
  const installed = bridge;
  return {
    calls: (route) => installed.count(route),
    on: (route, handler) => installed.on(route, handler),
  };
}

/** Promesse résolue à la main : pour tenir une requête « en vol ». */
export function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

/** Cache de test : aucune nouvelle tentative, fraîcheur de l'application. */
export function testQueryClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 60_000 } } });
}

/**
 * Fournisseurs des hooks : cache, session du module (sur le backend installé AU MOMENT du
 * rendu), notifications (les mutations signalent leurs échecs par `sonner`), et routeur pour
 * ceux qui naviguent.
 */
export function hookWrapper(queryClient: QueryClient, options: { router?: boolean } = {}) {
  const main = new FakeMainClient();
  const installed = bridge;
  const session: KanbanSession = {
    hydrated: true,
    userId: currentUserId,
    profile: null,
    client: createSdkKanbanClient(() => main, () => installed),
  };
  // `createElement` et non du JSX : ce fichier reste un `.ts`, que la règle `react-refresh`
  // (un fichier `.tsx` n'exporte que des composants) ne vise pas.
  return function HookWrapper({ children }: { children: ReactNode }) {
    const tree = createElement(KanbanSessionContext.Provider, { value: session }, children, createElement(Toaster));
    return createElement(QueryClientProvider, { client: queryClient }, options.router ? createElement(MemoryRouter, null, tree) : tree);
  };
}
