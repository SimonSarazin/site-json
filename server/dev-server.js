import express from "express";
import { createServer as createViteServer } from "vite";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import serialize from "serialize-javascript";
import dotenv from "dotenv";
import { helloassoCheckoutIntentHandler, helloassoTokenHandler, helloassoCallbackHandler, helloassoCheckoutStatusHandler, helloassoDiagnosticHandler } from "./api/helloasso-checkout.js";
import { createImageOptimizer } from "./middleware/imageOptimizer.js";
import { createImageUpload } from "./middleware/imageUpload.js";
import { normalizeSiteConfig } from "./utils/normalizeSiteConfig.js";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadSitesJson() {
  const sitesPath = path.resolve(process.cwd(), "sites.json");
  if (!fs.existsSync(sitesPath)) return [];
  return JSON.parse(fs.readFileSync(sitesPath, "utf-8"));
}

function findSiteBySlug(slug) {
  const sites = loadSitesJson();
  return sites.find((s) => s.slug === slug) || null;
}

function resolveSiteConfigPath() {
  if (process.env.SITE_CONFIG_PATH) return process.env.SITE_CONFIG_PATH;

  const slug = process.env.VITE_SLUG;
  if (!slug) return null;

  const site = findSiteBySlug(slug);
  if (!site) {
    const sites = loadSitesJson();
    console.warn(`[sites.json] Slug "${slug}" non trouvé, slugs disponibles : ${sites.map((s) => s.slug).join(", ")}`);
    return null;
  }

  const configPath = `./${site.config}`;
  process.env.SITE_CONFIG_PATH = configPath;
  console.log(`[sites.json] Slug "${slug}" → ${site.config}`);
  return configPath;
}

async function loadSingleConfig() {
  if (process.env.SITE_CONFIG_JSON) {
    try { return JSON.parse(process.env.SITE_CONFIG_JSON); }
    catch (e) { throw new Error(`SITE_CONFIG_JSON invalide : ${e.message}`); }
  }
  const configRelPath = resolveSiteConfigPath();
  if (configRelPath) {
    try {
      const filePath = path.isAbsolute(configRelPath) ? configRelPath : path.resolve(process.cwd(), configRelPath);
      return JSON.parse(fs.readFileSync(filePath, "utf-8"));
    } catch (e) {
      throw new Error(`Impossible de lire ${configRelPath} : ${e.message}`);
    }
  }
  return null;
}

async function createServer() {
  const app  = express();
  const vite = await createViteServer({
    server: { 
      middlewareMode: true,
      allowedHosts: true,
    },
    appType: "custom",
    ssr: { noExternal: ["@radix-ui/*", "lucide-react", "@communecter/cocolight-api-client"] },
  });

  app.use("/img", createImageOptimizer({
    staticRoot: path.resolve(__dirname, "../public"),
    cacheDir: path.resolve(__dirname, "../.cache/images"),
  }));

  app.post("/api/admin/upload-image", createImageUpload({
    staticRoot: path.resolve(__dirname, "../public"),
  }));

  // Middleware JSON pour les requêtes API (DOIT être AVANT les routes)
  app.use(express.json());

  // Routes API HelloAsso
  app.get("/api/helloasso/token", helloassoTokenHandler);
  app.post("/api/helloasso/checkout-intent", helloassoCheckoutIntentHandler);
  app.get("/api/helloasso/callback", helloassoCallbackHandler);
  app.get("/api/helloasso/checkout-status/:checkoutIntentId", helloassoCheckoutStatusHandler);
  app.get("/api/helloasso/orgs", helloassoDiagnosticHandler);

  // Flux RSS des articles blog (SEO/distribution). costumSlug : ?costum= > config.blog.feedCostumSlug > env.
  app.get("/blog/feed.xml", async (req, res) => {
    try {
      const slug = req.query.costum || cachedConfig?.blog?.feedCostumSlug || process.env.VITE_FEED_COSTUM_SLUG;
      if (!slug) { res.status(400).type("application/xml").send('<?xml version="1.0"?><error>costumSlug manquant (?costum=slug ou config.blog.feedCostumSlug)</error>'); return; }
      const { renderBlogFeed } = await vite.ssrLoadModule("/src/modules/blog/server/feed.ts");
      const title = cachedConfig?.meta?.title?.fr || cachedConfig?.meta?.title || "Articles";
      const xml = await renderBlogFeed({ costumSlug: String(slug), title });
      res.type("application/rss+xml").send(xml);
    } catch (e) {
      console.error("[blog-feed]", e);
      res.status(500).type("application/xml").send('<?xml version="1.0"?><error>erreur flux</error>');
    }
  });

  // ⚠️ Middleware Vite DOIT être après les routes API
  app.use(vite.middlewares);

  const singleSlug = process.env.VITE_SLUG;
  let cachedConfig = await loadSingleConfig();
  if (!cachedConfig) {
    console.log("Pas de config externe, chargement de demo-site.ts...");
    const { demoSiteConfig } = await vite.ssrLoadModule("/src/data/demo-site.ts");
    cachedConfig = demoSiteConfig;
  }
  // Pré-sanitize les champs HTML/SVG pour SSR/client identiques (cf. utils/normalizeSiteConfig.js)
  cachedConfig = normalizeSiteConfig(cachedConfig);
  console.log("Config chargée :", cachedConfig?.meta?.title?.fr || "Config OK");

  if (process.env.SITE_CONFIG_PATH) {
    const envPath = process.env.SITE_CONFIG_PATH;
    const configPath = path.isAbsolute(envPath) ? envPath : path.resolve(process.cwd(), envPath);
    fs.watchFile(configPath, { interval: 500 }, () => {
      try {
        cachedConfig = normalizeSiteConfig(JSON.parse(fs.readFileSync(configPath, "utf-8")));
        console.log("[HMR] Config reloaded, sending to clients...");
        vite.ws.send({ type: "custom", event: "config-update", data: cachedConfig });
      } catch (e) { console.error("[HMR] Config reload error:", e.message); }
    });
    console.log(`[HMR] Watching config: ${configPath}`);
  }

  vite.ws.on("config-save", (data) => {
    if (!process.env.SITE_CONFIG_PATH) { console.error("[Admin] SITE_CONFIG_PATH non défini"); return; }
    const envPath = process.env.SITE_CONFIG_PATH;
    const configPath = path.isAbsolute(envPath) ? envPath : path.resolve(process.cwd(), envPath);
    fs.writeFileSync(configPath, JSON.stringify(data, null, 2) + "\n", "utf-8");
    cachedConfig = normalizeSiteConfig(data);
    console.log("[Admin] Config saved to", configPath);
  });

  app.use((req, res, next) => {
    // Exclure les routes API
    if (req.url.startsWith("/api/")) {
      return next();
    }

    if (
      req.url.startsWith("/favicon") || req.url.startsWith("/sw") || req.url.startsWith("/manifest") ||
      req.url.match(/\.(png|jpg|jpeg|gif|svg|css|js|json|ico|webp|mp4|woff2|woff|env|php|txt|py|properties|bak)$/)
    ) return res.status(404).end();
    next();
  });

  /* ---- SSR render --------------------------------------------------- */
  async function renderSite(req, res, config, slug) {
    const timings = {};
    const startTotal = performance.now();
    try {
      const url = req.originalUrl;
      let t0 = performance.now();
      let template = fs.readFileSync(path.resolve(__dirname, "../index.html"), "utf-8");
      template = await vite.transformIndexHtml(url, template);
      timings.template = (performance.now() - t0).toFixed(1);

      const cfgScript = `<script>window.__CONFIG__=${serialize(config, { isJSON: true })}</script>`;

      const envSlug = slug || process.env.VITE_SLUG || "";
      const envScript = envSlug ? `<script>window.__ENV__={VITE_SLUG:${JSON.stringify(envSlug)},VITE_BASE_URL_BACKEND:${JSON.stringify(process.env.VITE_BASE_URL_BACKEND || "")},VITE_SERVER_URL:${JSON.stringify(process.env.VITE_SERVER_URL || "")}}</script>` : "";

      const [headStart, rest] = template.split("<!--app-head-->");
      const [beforeBody, tail] = rest.split("<!--app-html-->");

      res.status(200).setHeader("Content-Type", "text/html; charset=utf-8");
      res.write(headStart);
      res.write(cfgScript);
      res.write(envScript);

      t0 = performance.now();
      const { render } = await vite.ssrLoadModule("/src/entry-server.tsx");
      timings.loadEntryServer = (performance.now() - t0).toFixed(1);

      t0 = performance.now();
      await render(req, res, config, (helmetHead, dehydratedState) => {
        res.write(helmetHead);
        res.write(`<script>window.__REACT_QUERY_STATE__=${serialize(dehydratedState, { isJSON: true })}</script>`);
        res.write(beforeBody);
      }, tail);
      timings.render = (performance.now() - t0).toFixed(1);

      // S'assurer que la réponse est bien fermée après le streaming
      // (cf. fix 30ed931 — sans ce res.end(), le navigateur reste en readyState
      // "loading" et le bundle entry-client.tsx ne s'exécute jamais → loader infini)
      if (!res.writableEnded) {
        res.end();
      }

      timings.total = (performance.now() - startTotal).toFixed(1);
      console.log(`[PERF] ${slug || "single"}:${url} → template:${timings.template}ms | loadEntry:${timings.loadEntryServer}ms | render:${timings.render}ms | TOTAL:${timings.total}ms`);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      // Ignorer les erreurs de stream fermé (client déconnecté pendant le cold start)
      if (e?.code === 'ERR_STREAM_WRITE_AFTER_END' || e?.code === 'ERR_STREAM_DESTROYED') {
        return;
      }
      console.error("SSR Error:", e);
      if (!res.headersSent) {
        res.status(500).end("Internal Server Error");
      } else {
        res.end();
      }
    }
  }

  app.use(["/{*all}"], async (req, res) => {
    await renderSite(req, res, cachedConfig, singleSlug);
  });

  /**
   * Warmup bloquant — force Vite à compiler entry-server.tsx + toute sa chaîne
   * d'imports AVANT que le premier hit utilisateur n'arrive. Sans ça, le 1er
   * hit au cold start déclenche la compilation pendant le rendu SSR, ce qui
   * peut produire un <div id="root"> vide (modules pas tous résolus quand
   * React rend) → "Hydration failed" au client.
   *
   * `server.warmup` dans vite.config.ts est asynchrone non-bloquant, donc
   * insuffisant ici.
   */
  console.log("[warmup] Pré-compilation SSR en cours...");
  const t0 = performance.now();
  try {
    await vite.ssrLoadModule("/src/entry-server.tsx");
    console.log(`[warmup] SSR prêt en ${(performance.now() - t0).toFixed(0)}ms`);
  } catch (e) {
    console.error("[warmup] Échec :", e.message);
  }

  const port = process.env.PORT || 5173;
  app.listen(port, () => {
    console.log(`SSR Dev server running at http://localhost:${port}`);
  });
}

createServer().catch(console.error);
