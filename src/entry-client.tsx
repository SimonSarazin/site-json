import "@/i18n";

import { hydrateRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider, type RouterState } from "react-router";
import { HelmetProvider } from "@dr.pogodin/react-helmet";
import { buildRoutes } from "@/lib/buildRoutes";
import { type SiteConfig } from '@/types/site';
import "./index.css";
import { HydrationBoundary, QueryClient, QueryClientProvider, type DehydratedState } from "@tanstack/react-query";
import { useState, useEffect } from "react";


// La config JSON sérialisée par le serveur est injectée dans le global
declare global {
  interface Window {
    __CONFIG__: SiteConfig;
    __REACT_QUERY_STATE__: DehydratedState | undefined;
    __staticRouterHydrationData?: Partial<
      Pick<RouterState, "errors" | "loaderData" | "actionData">
    >;
  }
}

const siteConfig = window.__CONFIG__;
const dehydratedState = window.__REACT_QUERY_STATE__ ?? null;

// buildRoutes retourne RouteObject[] (sync) ou Promise<RouteObject[]> (async)
// Sync : côté client avec modules core uniquement → pas de flash loading
// Async : côté serveur ou modules optional → loading temporaire
const routesOrPromise = buildRoutes(siteConfig);

const container = document.getElementById("root");

// eslint-disable-next-line react-refresh/only-export-components
function Root() {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        // Évite le refetch immédiat après l'hydratation
        staleTime: 60 * 1000,
      },
    },
  }));

  const [router, setRouter] = useState<ReturnType<typeof createBrowserRouter> | null>(() => {
    // Initialisation du router
    if (routesOrPromise instanceof Promise) {
      // Async : modules optional → on initialise à null et on chargera dans useEffect
      return null;
    } else {
      // Sync : modules core → on crée le router immédiatement (pas de flash!)
      return createBrowserRouter(routesOrPromise, {
        hydrationData: window.__staticRouterHydrationData
      });
    }
  });

  // Charger le router de manière asynchrone si nécessaire
  useEffect(() => {
    if (routesOrPromise instanceof Promise) {
      routesOrPromise
        .then((routes) => createBrowserRouter(routes, {
          hydrationData: window.__staticRouterHydrationData
        }))
        .then(setRouter);
    }
  }, []);

  if (!router) {
    // Modules optional en chargement : on garde le HTML SSR intact
    return null;
  }

  return (
  <HelmetProvider>
    <QueryClientProvider client={queryClient}>
      <HydrationBoundary state={dehydratedState}>
          <RouterProvider router={router} />
    </HydrationBoundary>
    </QueryClientProvider>
  </HelmetProvider>
  );
}

if (container) {
  hydrateRoot(container, <Root />);
} else {
  console.error("❌ #root non trouvé pour l'hydratation");
}
