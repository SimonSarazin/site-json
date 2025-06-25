import { hydrateRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router";
import { HelmetProvider } from "@dr.pogodin/react-helmet";
import { buildRoutes } from "@/lib/buildRoutes";
import "./index.css";
import "./App.css";

// La config JSON sérialisée par le serveur est injectée dans le global
declare global {
  interface Window {
    __CONFIG__: any; // typage léger, adapte si tu exposes SiteConfig
  }
}

const siteConfig = window.__CONFIG__;

// Construit le Data Router à partir des pages du JSON
const router = createBrowserRouter(buildRoutes(siteConfig), {
  // Active le pré‑fetch sur hover/focus des <Link prefetch="intent"/>
  future: { v7_preloadOnHover: true },
});

hydrateRoot(
  document.getElementById("root")!,
  <HelmetProvider>
    <RouterProvider router={router} />
  </HelmetProvider>
);
