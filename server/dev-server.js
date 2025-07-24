import express from "express";
import { createServer as createViteServer } from "vite";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import serialize from "serialize-javascript";
import dotenv from "dotenv";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function loadSiteConfig() {
  // 1. JSON inline (variable d’environnement complète)
  if (process.env.SITE_CONFIG_JSON) {
    try {
      return JSON.parse(process.env.SITE_CONFIG_JSON);
    } catch (e) {
      throw new Error(`SITE_CONFIG_JSON invalide : ${e.message}`);
    }
  }

  // 2. Chemin vers un fichier JSON
  if (process.env.SITE_CONFIG_PATH) {
    try {
      const envPath   = process.env.SITE_CONFIG_PATH;
      const filePath  = path.isAbsolute(envPath)
        ? envPath
        : path.resolve(process.cwd(), envPath);
      const raw      = fs.readFileSync(filePath, "utf-8");
      return JSON.parse(raw);
    } catch (e) {
      throw new Error(`Impossible de lire SITE_CONFIG_PATH : ${e.message}`);
    }
  }

  // Si nous sommes en production et rien n’a été fourni :
  throw new Error(
    "🛑  Aucune configuration trouvée : définissez SITE_CONFIG_JSON ou SITE_CONFIG_PATH (obligatoire en production)"
  );
}

async function createServer() {
  const app  = express();
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: "custom",
    ssr: { noExternal: ["@radix-ui/*", "lucide-react", "@communecter/cocolight-api-client"] },
  });
  app.use(vite.middlewares);

  app.use((req, res, next) => {
  if (
    req.url.startsWith("/favicon") ||
    req.url.startsWith("/sw") ||
    req.url.startsWith("/manifest") ||
    req.url.match(/\.(png|jpg|jpeg|gif|svg|css|js|json|ico|webp|mp4|woff2|woff|env|php|txt|py|properties|bak)$/)
  ) {
    return res.status(404).end();
  }
  next();
});

  /* ------------------------------------------------------------------ */
  app.use(["/{*all}"], async (req, res) => {
    try {
      const url      = req.originalUrl;
      let template   = fs.readFileSync(path.resolve(__dirname, "../index.html"), "utf-8");
      template       = await vite.transformIndexHtml(url, template);

      /* ---- 1. Config JSON dans <head> -------------------------------- */
      const siteConfig = await loadSiteConfig();
      const { demoSiteConfig } = await vite.ssrLoadModule("/src/data/demo-site.ts");
      const config = siteConfig || demoSiteConfig;
      const cfgScript = `<script>window.__CONFIG__=${serialize(config, { isJSON:true })}</script>`;
      

      /* ---- 2. On découpe le template --------------------------------- */
      const [headStart, rest] = template.split("<!--app-head-->");
      const [beforeBody, tail] = rest.split("<!--app-html-->");

      

      /* ---- 3. Envoie du <head> ouvert + config ----------------------- */
      res.status(200).setHeader("Content-Type", "text/html; charset=utf-8");
      res.write(headStart);             // <!doctype … <head>
      res.write(cfgScript);             // script de config — UNIQUEMENT ici

      /* ---- 4. Lance le rendu React ----------------------------------- */
      const { render } = await vite.ssrLoadModule("/src/entry-server.tsx");

      await render(req, res, config, (helmetHead, dehydratedState) => {
        /* callback appelé par entry-server quand Helmet est prêt */
        res.write(helmetHead);          // balises <title>, <meta>, …
        res.write(`<script>window.__REACT_QUERY_STATE__=${serialize(
                    dehydratedState, { isJSON: true }
                  )}</script>`);
        res.write(beforeBody);          // </head><body><div id="root">
      });

    } catch (e) {
      vite.ssrFixStacktrace(e);
      console.error("SSR Error:", e);
      res.status(500).end("Internal Server Error");
    }
  });
  /* ------------------------------------------------------------------ */

  const port = process.env.PORT || 5173;
  app.listen(port, () => console.log(`SSR Dev server running at http://localhost:${port}`));
}

createServer().catch(console.error);
