import "@/i18n";

import { hydrateRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider, type RouterState } from "react-router";
import { HelmetProvider } from "@dr.pogodin/react-helmet";
import { buildRoutes } from "@/lib/buildRoutes";
import { type SiteConfig } from '@/types/site';
// import "./index-rezo-la-mer.css";
import "./index-cyber-reunion.css";
// import "./index-tiers-lieux.css";
// import "./index-sport-sante-bien-etre.css";
// import "./index-julie-pot-vin.css";
import { HydrationBoundary, QueryClient, QueryClientProvider, type DehydratedState } from "@tanstack/react-query";
import { useState, useEffect } from "react";

function areStylesheetsLoaded(): boolean {
  const stylesheets = document.querySelectorAll('link[rel="stylesheet"]');
  for (const sheet of stylesheets) {
    const linkEl = sheet as HTMLLinkElement;
    if (linkEl.sheet === null) {
      return false;
    }
  }
  return true;
}

function hideLoader() {
  const loader = document.getElementById('app-loader');
  const root = document.getElementById('root');

  document.documentElement.classList.remove('loading-active');

  if (loader) {
    loader.classList.add('hidden');
    setTimeout(() => {
      loader.remove();
      const criticalStyles = document.getElementById('critical-loader');
      if (criticalStyles) criticalStyles.remove();
    }, 300);
  }

  if (root) {
    root.classList.add('loaded');
  }
}

function waitForStylesAndHideLoader() {
  if (areStylesheetsLoaded()) {
    requestAnimationFrame(() => {
      hideLoader();
    });
  } else {
    setTimeout(waitForStylesAndHideLoader, 50);
  }
}


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

if (import.meta.hot) {
  import.meta.hot.on('config-update', (newConfig: SiteConfig) => {
    console.log('load...');
    window.__CONFIG__ = newConfig;
    window.dispatchEvent(new CustomEvent('site-config-update', { detail: newConfig }));
  });
}

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

  useEffect(() => {
    if (router) {
      waitForStylesAndHideLoader();
    }
  }, [router]);

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
