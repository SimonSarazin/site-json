import { hydrateRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router";
import { HelmetProvider } from "@dr.pogodin/react-helmet";
import { buildRoutes } from "@/lib/buildRoutes";
import { type SiteConfig } from '@/types/site';
import "./index.css";

// La config JSON sérialisée par le serveur est injectée dans le global
declare global {
  interface Window {
    __CONFIG__: SiteConfig;
  }
}

const siteConfig = window.__CONFIG__;

// Construit le Data Router à partir des pages du JSON
const router = createBrowserRouter(buildRoutes(siteConfig));

hydrateRoot(
  document.getElementById("root")!,
  <HelmetProvider>
    <RouterProvider router={router} />
  </HelmetProvider>
);
