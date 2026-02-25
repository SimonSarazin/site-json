import express from "express";
import { createServer as createViteServer } from "vite";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import serialize from "serialize-javascript";
import dotenv from "dotenv";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function resolveSiteConfigPath() {
  if (process.env.SITE_CONFIG_PATH) return process.env.SITE_CONFIG_PATH;

  const slug = process.env.VITE_SLUG;
  if (!slug) return null;

  const sitesPath = path.resolve(process.cwd(), "sites.json");
  if (!fs.existsSync(sitesPath)) return null;

  const sites = JSON.parse(fs.readFileSync(sitesPath, "utf-8"));
  const site = sites.find((s) => s.slug === slug);
  if (!site) {
    console.warn(`[sites.json] Slug "${slug}" non trouvé, slugs disponibles : ${sites.map((s) => s.slug).join(", ")}`);
    return null;
  }

  const configPath = `./${site.config}`;
  process.env.SITE_CONFIG_PATH = configPath;
  console.log(`[sites.json] Slug "${slug}" → ${site.config}`);
  return configPath;
}

async function loadSiteConfig() {
  // 1. JSON inline (variable d’environnement complète)
  if (process.env.SITE_CONFIG_JSON) {
    try {
      return JSON.parse(process.env.SITE_CONFIG_JSON);
    } catch (e) {
      throw new Error(`SITE_CONFIG_JSON invalide : ${e.message}`);
    }
  }

  const configRelPath = resolveSiteConfigPath();
  if (configRelPath) {
    try {
      const filePath = path.isAbsolute(configRelPath)
        ? configRelPath
        : path.resolve(process.cwd(), configRelPath);
      const raw = fs.readFileSync(filePath, "utf-8");
      return JSON.parse(raw);
    } catch (e) {
      throw new Error(`Impossible de lire ${configRelPath} : ${e.message}`);
    }
  }

  return null;
}

async function createServer() {
  const app  = express();
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: "custom",
    ssr: { noExternal: ["@radix-ui/*", "lucide-react", "@communecter/cocolight-api-client"] },
  });
  app.use(vite.middlewares);

  /* ---- Charger la config UNE SEULE FOIS au démarrage ---------------- */
  let cachedConfig = await loadSiteConfig();
  if (!cachedConfig) {
    console.log("Pas de config externe, chargement de demo-site.ts...");
    const { demoSiteConfig } = await vite.ssrLoadModule("/src/data/demo-site.ts");
    cachedConfig = demoSiteConfig;
  }
  console.log("Config chargée :", cachedConfig?.meta?.title?.fr || "Config OK");

  if (process.env.SITE_CONFIG_PATH) {
    const envPath = process.env.SITE_CONFIG_PATH;
    const configPath = path.isAbsolute(envPath)
      ? envPath
      : path.resolve(process.cwd(), envPath);

    fs.watchFile(configPath, { interval: 500 }, () => {
      try {
        const raw = fs.readFileSync(configPath, "utf-8");
        const newConfig = JSON.parse(raw);
        cachedConfig = newConfig;
        console.log("[HMR] Config reloaded, sending to clients...");
        vite.ws.send({ type: "custom", event: "config-update", data: newConfig });
      } catch (e) {
        console.error("[HMR] Config reload error:", e.message);
      }
    });
    console.log(`[HMR] Watching config: ${configPath}`);
  }

  vite.ws.on("config-save", (data) => {
    if (!process.env.SITE_CONFIG_PATH) {
      console.error("[Admin] SITE_CONFIG_PATH non défini, impossible de sauvegarder");
      return;
    }
    const envPath = process.env.SITE_CONFIG_PATH;
    const configPath = path.isAbsolute(envPath)
      ? envPath
      : path.resolve(process.cwd(), envPath);

    try {
      const json = JSON.stringify(data, null, 2) + "\n";
      fs.writeFileSync(configPath, json, "utf-8");
      cachedConfig = data;
      console.log("[Admin] Config saved to", configPath);
    } catch (e) {
      console.error("[Admin] Save error:", e.message);
    }
  });

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
    const timings = {};
    const startTotal = performance.now();

    try {
      const url      = req.originalUrl;

      let t0 = performance.now();
      let template   = fs.readFileSync(path.resolve(__dirname, "../index.html"), "utf-8");
      template       = await vite.transformIndexHtml(url, template);
      timings.template = (performance.now() - t0).toFixed(1);

      /* ---- 1. Config JSON dans <head> -------------------------------- */
      const config = cachedConfig;
      const cfgScript = `<script>window.__CONFIG__=${serialize(config, { isJSON:true })}</script>`;


      /* ---- 2. On découpe le template --------------------------------- */
      const [headStart, rest] = template.split("<!--app-head-->");
      const [beforeBody, tail] = rest.split("<!--app-html-->");



      /* ---- 3. Envoie du <head> ouvert + config ----------------------- */
      res.status(200).setHeader("Content-Type", "text/html; charset=utf-8");
      res.write(headStart);             // <!doctype … <head>
      res.write(cfgScript);             // script de config — UNIQUEMENT ici

      /* ---- 4. Lance le rendu React ----------------------------------- */
      t0 = performance.now();
      const { render } = await vite.ssrLoadModule("/src/entry-server.tsx");
      timings.loadEntryServer = (performance.now() - t0).toFixed(1);

      t0 = performance.now();
      await render(req, res, config, (helmetHead, dehydratedState) => {
        /* callback appelé par entry-server quand Helmet est prêt */
        res.write(helmetHead);          // balises <title>, <meta>, …
        res.write(`<script>window.__REACT_QUERY_STATE__=${serialize(
                    dehydratedState, { isJSON: true }
                  )}</script>`);
        res.write(beforeBody);          // </head><body><div id="root">
      });
      timings.render = (performance.now() - t0).toFixed(1);

      timings.total = (performance.now() - startTotal).toFixed(1);
      console.log(`[PERF] ${url} → template:${timings.template}ms | loadEntry:${timings.loadEntryServer}ms | render:${timings.render}ms | TOTAL:${timings.total}ms`);

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
