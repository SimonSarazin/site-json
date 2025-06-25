import { renderToPipeableStream } from "react-dom/server";
import express from "express";
import { HelmetProvider } from "@dr.pogodin/react-helmet";
import {
  createStaticHandler,
  createStaticRouter,
  StaticRouterProvider,
} from "react-router"; // v7: les APIs serveur viennent du paquet central
import { buildRoutes } from "@/lib/buildRoutes";
// import { demoSiteConfig } from "@/data/demo-site";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type { SiteConfig } from "@/types/site";

/** Durée max (ms) avant d’abandonner une Suspense bloquée */
const STREAM_TIMEOUT_MS = 10_000;

/* -------------------------------------------------------------------------- */
/* Util pour retrouver le bundle client                                       */
/* -------------------------------------------------------------------------- */
function resolveClientBundle(): string {
  const isProd = process.env.NODE_ENV === "production";
  if (!isProd) return "/src/entry-client.tsx";

  try {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const manifestPath = path.resolve(__dirname, "../client/.vite/manifest.json");
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
    const entry =
      manifest["src/entry-client.tsx"] ||
      Object.values(manifest).find((m: any) => m && m.isEntry);
    if (entry && (entry as any).file) return "/" + (entry as any).file;
  } catch {
    /* empty */
  }
  return "/assets/entry-client.js";
}

/* -------------------------------------------------------------------------- */
/* Fonction de rendu SSR streaming                                             */
/* -------------------------------------------------------------------------- */
export function render(
  req: express.Request,
  res: express.Response,
  demoSiteConfig: SiteConfig,
  htmlEnd = "</body></html>",
): Promise<void> {
  return new Promise<void>(async (resolve, reject) => {
    const helmetContext: Record<string, any> = {};
    const clientBundle = resolveClientBundle();

    /* 1. Créer le handler + router static à partir des routes dynamiques */
    const handler = createStaticHandler(buildRoutes(demoSiteConfig));
 
    const absUrl   = "http://localhost" + (req.originalUrl || req.url || "/");

    const fetchRequest = new Request(absUrl, {
      method: req.method,
      headers: req.headers as any,
      body:   req.method === "GET" || req.method === "HEAD" ? null : req.body,
    });

    const context = await handler.query(fetchRequest);

    // Rediriger immédiatement si le loader retourne une Response
    if (context instanceof Response) {
      res.status(context.status).set(Object.fromEntries(context.headers));
      res.end(await context.text());
      return resolve();
    }

    const router = createStaticRouter(handler.dataRoutes, context);

    /* 2. Streaming React 19 */
    const { pipe, abort } = renderToPipeableStream(
      <HelmetProvider context={helmetContext}>
        <StaticRouterProvider router={router} context={context} />
      </HelmetProvider>,
      {
        bootstrapModules: process.env.NODE_ENV === "production" ? undefined : [clientBundle],
        bootstrapScripts:  process.env.NODE_ENV === "production" ? [clientBundle] : undefined,
        onShellReady() { pipe(res); },
        onAllReady()   { res.write(htmlEnd); res.end(); resolve(); },
        onShellError(err) { console.error(err); res.status(500).end("Erreur serveur"); reject(err); },
        onError(err)   { console.error("Streaming error", err); },
      }
    );

    /* Timeout / connexion fermée */
    const t = setTimeout(() => { abort(); resolve(); }, STREAM_TIMEOUT_MS);
    res.on("close", () => { clearTimeout(t); abort(); resolve(); });
  });
}
