import "@/i18n";

import { hydrateRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router";
import { HelmetProvider } from "@dr.pogodin/react-helmet";
import { buildRoutes } from "@/lib/buildRoutes";
import { type SiteConfig } from '@/types/site';
import "./index.css";
import { HydrationBoundary, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

// La config JSON sérialisée par le serveur est injectée dans le global
declare global {
  interface Window {
    __CONFIG__: SiteConfig;
    __REACT_QUERY_STATE__: unknown;
  }
}

const siteConfig = window.__CONFIG__;

// Construit le Data Router à partir des pages du JSON
const router = createBrowserRouter(buildRoutes(siteConfig));

const dehydratedState = window.__REACT_QUERY_STATE__ ? window.__REACT_QUERY_STATE__ : null;



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