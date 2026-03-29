import express from "express";
import { createServer as createViteServer } from "vite";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import serialize from "serialize-javascript";
import dotenv from "dotenv";
import { createImageOptimizer } from "./middleware/imageOptimizer.js";
import { createImageUpload } from "./middleware/imageUpload.js";

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

function resolveCssForSlug(slug) {
  if (!slug) return null;
  const site = findSiteBySlug(slug);
  return site?.css || null;
}

function getDefaultCss() {
  const sites = loadSitesJson();
  return sites[0]?.css || null;
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

function loadSitesRegistry() {
  const sites = loadSitesJson();
  const registry = new Map();
  for (const site of sites) {
    const configPath = path.resolve(process.cwd(), `./${site.config}`);
    if (!fs.existsSync(configPath)) {
      console.warn(`[sites] Config introuvable pour "${site.slug}": ${site.config}`);
      continue;
    }
    try {
      const raw = fs.readFileSync(configPath, "utf-8");
      registry.set(site.slug, { config: JSON.parse(raw), configPath, meta: site });
      console.log(`[sites] Chargé: ${site.slug} → ${site.config}`);
    } catch (e) {
      console.warn(`[sites] Erreur chargement "${site.slug}": ${e.message}`);
    }
  }
  return registry;
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
    server: { middlewareMode: true },
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

  app.use(vite.middlewares);

  const singleSlug = process.env.VITE_SLUG;
  const isMultiSite = !singleSlug;
  let siteRegistry = isMultiSite ? loadSitesRegistry() : new Map();
  let cachedConfig = null;

  if (!isMultiSite) {
    cachedConfig = await loadSingleConfig();
    if (!cachedConfig) {
      console.log("Pas de config externe, chargement de demo-site.ts...");
      const { demoSiteConfig } = await vite.ssrLoadModule("/src/data/demo-site.ts");
      cachedConfig = demoSiteConfig;
    }
    console.log("Config chargée :", cachedConfig?.meta?.title?.fr || "Config OK");
  } else {
    console.log(`[multi-site] ${siteRegistry.size} site(s) chargé(s)`);
  }

  if (!isMultiSite && process.env.SITE_CONFIG_PATH) {
    const envPath = process.env.SITE_CONFIG_PATH;
    const configPath = path.isAbsolute(envPath) ? envPath : path.resolve(process.cwd(), envPath);
    fs.watchFile(configPath, { interval: 500 }, () => {
      try {
        cachedConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
        console.log("[HMR] Config reloaded, sending to clients...");
        vite.ws.send({ type: "custom", event: "config-update", data: cachedConfig });
      } catch (e) { console.error("[HMR] Config reload error:", e.message); }
    });
    console.log(`[HMR] Watching config: ${configPath}`);
  }

  if (isMultiSite) {
    for (const [slug, entry] of siteRegistry) {
      fs.watchFile(entry.configPath, { interval: 500 }, () => {
        try {
          entry.config = JSON.parse(fs.readFileSync(entry.configPath, "utf-8"));
          console.log(`[HMR] Config reloaded for "${slug}"`);
        } catch (e) { console.error(`[HMR] Reload error "${slug}":`, e.message); }
      });
    }
  }

  vite.ws.on("config-save", (data) => {
    const saveSlug = data?._slug;
    if (isMultiSite && saveSlug) {
      const entry = siteRegistry.get(saveSlug);
      if (!entry) { console.error(`[Admin] Slug "${saveSlug}" non trouvé`); return; }
      const { _slug, ...configData } = data;
      fs.writeFileSync(entry.configPath, JSON.stringify(configData, null, 2) + "\n", "utf-8");
      entry.config = configData;
      console.log(`[Admin] Config saved for "${saveSlug}"`);
    } else {
      if (!process.env.SITE_CONFIG_PATH) { console.error("[Admin] SITE_CONFIG_PATH non défini"); return; }
      const envPath = process.env.SITE_CONFIG_PATH;
      const configPath = path.isAbsolute(envPath) ? envPath : path.resolve(process.cwd(), envPath);
      fs.writeFileSync(configPath, JSON.stringify(data, null, 2) + "\n", "utf-8");
      cachedConfig = data;
      console.log("[Admin] Config saved to", configPath);
    }
  });

  app.get("/api/admin/sites", (_req, res) => {
    const sites = loadSitesJson();
    const enriched = sites.map((s) => {
      const entry = siteRegistry.get(s.slug);
      return { ...s, title: entry?.config?.meta?.title?.fr || s.slug, description: entry?.config?.meta?.description?.fr || "" };
    });
    res.json(enriched);
  });

  app.post("/api/admin/sites", express.json(), (req, res) => {
    const { slug, name, configFile, css } = req.body;
    if (!slug || !configFile) return res.status(400).json({ error: "slug et configFile requis" });
    const sitesPath = path.resolve(process.cwd(), "sites.json");
    const sites = fs.existsSync(sitesPath) ? JSON.parse(fs.readFileSync(sitesPath, "utf-8")) : [];
    if (sites.find((s) => s.slug === slug)) return res.status(409).json({ error: `Slug "${slug}" existe déjà` });

    const configPath = path.resolve(process.cwd(), configFile);
    if (!fs.existsSync(configPath)) {
      const defaultConfig = {
        meta: { title: { fr: name || slug }, defaultLang: "fr", languages: ["fr"] },
        header: { type: "default", logo: "", nav: [], sticky: true, transparent: false },
        pages: [{ path: "/", title: { fr: "Accueil" }, sections: [] }],
        footer: { type: "default", columns: [], copyright: { fr: `© ${new Date().getFullYear()} ${name || slug}` } },
      };
      fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2) + "\n", "utf-8");
    }
    sites.push({ slug, config: configFile, css: css || null });
    fs.writeFileSync(sitesPath, JSON.stringify(sites, null, 2) + "\n", "utf-8");

    const raw = fs.readFileSync(configPath, "utf-8");
    siteRegistry.set(slug, { config: JSON.parse(raw), configPath, meta: { slug, config: configFile, css } });
    console.log(`[Admin] Nouveau site créé: "${slug}" → ${configFile}`);
    res.json({ ok: true, slug });
  });

  app.use((req, res, next) => {
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

      const cssName = resolveCssForSlug(slug) || getDefaultCss();
      const cssLink = cssName ? `<link rel="stylesheet" href="/src/${cssName}.css">` : "";

      const [headStart, rest] = template.split("<!--app-head-->");
      const [beforeBody, tail] = rest.split("<!--app-html-->");

      res.status(200).setHeader("Content-Type", "text/html; charset=utf-8");
      res.write(headStart);
      res.write(cfgScript);
      res.write(envScript);
      res.write(cssLink);

      t0 = performance.now();
      const { render } = await vite.ssrLoadModule("/src/entry-server.tsx");
      timings.loadEntryServer = (performance.now() - t0).toFixed(1);

      t0 = performance.now();
      await render(req, res, config, (helmetHead, dehydratedState) => {
        res.write(helmetHead);
        res.write(`<script>window.__REACT_QUERY_STATE__=${serialize(dehydratedState, { isJSON: true })}</script>`);
        res.write(beforeBody);
      });
      timings.render = (performance.now() - t0).toFixed(1);
      timings.total = (performance.now() - startTotal).toFixed(1);
      console.log(`[PERF] ${slug || "single"}:${url} → template:${timings.template}ms | loadEntry:${timings.loadEntryServer}ms | render:${timings.render}ms | TOTAL:${timings.total}ms`);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      console.error("SSR Error:", e);
      if (!res.headersSent) res.status(500).end("Internal Server Error");
    }
  }

  if (isMultiSite) {
    app.get("/", async (req, res) => {
      const sites = [];
      for (const [slug, entry] of siteRegistry) {
        sites.push({ slug, title: entry.config?.meta?.title?.fr || slug, description: entry.config?.meta?.description?.fr || "", logo: entry.config?.header?.logo || "" });
      }
      const homepageConfig = {
        meta: { title: { fr: "SiteForge - Annuaire" }, defaultLang: "fr", languages: ["fr"] },
        header: { type: "default", logo: "", nav: [], sticky: false, transparent: false, utilities: { themeSwitch: false, languageSwitch: false, authButton: false } },
        pages: [{ path: "/", title: { fr: "Annuaire" }, hideHeader: true, hideFooter: true, sections: [{ type: "siteList", id: "site-list", props: { sites } }] }],
        footer: { type: "default", columns: [], copyright: { fr: "SiteForge" } },
      };
      await renderSite(req, res, homepageConfig, null);
    });

    app.use("/s/:slug/{*rest}", async (req, res) => {
      const { slug } = req.params;
      const entry = siteRegistry.get(slug);
      if (!entry) return res.status(404).send(`Site "${slug}" non trouvé. <a href="/">Retour</a>`);
      req.originalUrl = req.originalUrl.replace(`/s/${slug}`, "") || "/";
      await renderSite(req, res, entry.config, slug);
    });

    app.get("/s/:slug", async (req, res) => {
      const { slug } = req.params;
      const entry = siteRegistry.get(slug);
      if (!entry) return res.status(404).send(`Site "${slug}" non trouvé. <a href="/">Retour</a>`);
      req.originalUrl = "/";
      await renderSite(req, res, entry.config, slug);
    });
  } else {
    app.use(["/{*all}"], async (req, res) => {
      await renderSite(req, res, cachedConfig, singleSlug);
    });
  }

  const port = process.env.PORT || 5173;
  app.listen(port, () => {
    if (isMultiSite) {
      console.log(`\n🌐 Multi-site dev server at http://localhost:${port}`);
      console.log(`   Homepage: http://localhost:${port}/`);
      for (const [slug] of siteRegistry) console.log(`   ${slug}: http://localhost:${port}/s/${slug}`);
    } else {
      console.log(`SSR Dev server running at http://localhost:${port}`);
    }
  });
}

createServer().catch(console.error);
