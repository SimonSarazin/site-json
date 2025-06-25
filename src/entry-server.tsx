import { renderToPipeableStream } from "react-dom/server";
import { HelmetProvider } from "@dr.pogodin/react-helmet";
import express from "express";
import App from "./App";
import { RouterProvider } from "./contexts/RouterContext";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

/**
 * Durée maximale (ms) avant d'abandonner un rendu SSR bloqué (Suspense / fetch).
 */
const STREAM_TIMEOUT_MS = 10_000;

/**
 * Retourne le chemin public du bundle client à inclure dans bootstrapScripts / bootstrapModules.
 * ↪︎ En dev : on pointe directement sur /src/entry-client.tsx (servi par Vite).
 * ↪︎ En prod : on lit .vite/manifest.json pour trouver le nom hashé.
 */
function resolveClientBundle(): string {
  const isProd = process.env.NODE_ENV === "production";
  if (!isProd) return "/src/entry-client.tsx";

  try {
    const __dirname = path.dirname(fileURLToPath(import.meta.url)); // dist/server
    const manifestPath = path.resolve(__dirname, "../client/.vite/manifest.json");
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
    const entry =
      manifest["src/entry-client.tsx"] ||
      Object.values(manifest).find((m: any) => m && m.isEntry);
    if (entry && (entry as any).file) return "/" + (entry as any).file;
  } catch (err) {
    console.warn("manifest.json introuvable — fallback /assets/entry-client.js", err);
  }
  return "/assets/entry-client.js"; // worst‑case
}

/**
 * Stream le HTML rendu par React puis écrit `htmlEnd` pour fermer le document.
 * La fonction renvoie une *promesse* qui se résout une fois la réponse terminée,
 * afin que le serveur (dev / prod) puisse `await` et NE PAS appeler res.end()
 * prématurément — évitant ainsi l'erreur "destination stream closed early".
 */
export function render(
  req: express.Request,
  res: express.Response,
  htmlEnd = "</body></html>"
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const isProd = process.env.NODE_ENV === "production";
    const clientBundlePath = resolveClientBundle();
    const helmetContext: Record<string, any> = {};

    console.log("SSR request for URL path:", req.originalUrl);

    const { pipe, abort } = renderToPipeableStream(
      <HelmetProvider context={helmetContext}>
        <RouterProvider initialPath={req.originalUrl}>
          <App />
        </RouterProvider>
      </HelmetProvider>,
      {
        ...(isProd
          ? { bootstrapScripts: [clientBundlePath] }
          : { bootstrapModules: [clientBundlePath] }),

        onShellReady() {
          pipe(res); // démarre le flux dès que possible
        },

        onAllReady() {
          res.write(htmlEnd);
          res.end();
          resolve();
        },

        onShellError(err) {
          console.error("Shell error:", err);
          if (!res.headersSent) {
            res.statusCode = 500;
            res.setHeader("Content-Type", "text/html");
          }
          res.end("<!doctype html><h1>Erreur serveur</h1>");
          reject(err);
        },

        onError(err) {
          console.error("Streaming error:", err);
        },
      }
    );

    // Abandonne si Suspense ne se résout pas ou si le client ferme la connexion
    const timeout = setTimeout(() => {
      abort();
      resolve();
    }, STREAM_TIMEOUT_MS);

    res.on("close", () => {
      clearTimeout(timeout);
      abort();
      resolve();
    });
  });
}
