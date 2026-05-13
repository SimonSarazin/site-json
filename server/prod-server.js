import express from "express";
import compression from "compression";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import serialize from "serialize-javascript";
import { createImageOptimizer } from "./middleware/imageOptimizer.js";
import { createImageUpload } from "./middleware/imageUpload.js";

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

/* ----------------------------------------------------------------------
 *  Chargement obligatoire de la configuration en production
 * -------------------------------------------------------------------- */
function loadSingleConfig() {
  if (process.env.SITE_CONFIG_JSON) {
    try { return JSON.parse(process.env.SITE_CONFIG_JSON); }
    catch (e) { throw new Error(`SITE_CONFIG_JSON invalide : ${e.message}`); }
  }
  if (process.env.SITE_CONFIG_PATH) {
    try {
      const envPath = process.env.SITE_CONFIG_PATH;
      const filePath = path.isAbsolute(envPath) ? envPath : path.resolve(process.cwd(), envPath);
      return JSON.parse(fs.readFileSync(filePath, "utf-8"));
    } catch (e) { throw new Error(`Impossible de lire SITE_CONFIG_PATH : ${e.message}`); }
  }
  return null;
}

function loadSitesRegistry() {
  const sites = loadSitesJson();
  const registry = new Map();
  for (const site of sites) {
    const configPath = path.resolve(process.cwd(), `./${site.config}`);
    if (!fs.existsSync(configPath)) { console.warn(`[sites] Config introuvable: "${site.slug}"`); continue; }
    try {
      const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      registry.set(site.slug, {
        config, configPath,
        configScript: `<script>window.__CONFIG__=${serialize(config, { isJSON: true })}</script>`,
        meta: site,
      });
      console.log(`[sites] Chargé: ${site.slug} → ${site.config}`);
    } catch (e) { console.warn(`[sites] Erreur "${site.slug}": ${e.message}`); }
  }
  return registry;
}

const singleSlug = process.env.VITE_SLUG;
const isMultiSite = !singleSlug && !process.env.SITE_CONFIG_PATH && !process.env.SITE_CONFIG_JSON;

let siteRegistry = isMultiSite ? loadSitesRegistry() : new Map();
let cachedConfig = null;
let configScript = "";

if (!isMultiSite) {
  cachedConfig = loadSingleConfig();
  if (!cachedConfig) {
    throw new Error("🛑  Aucune configuration trouvée : définissez SITE_CONFIG_JSON, SITE_CONFIG_PATH, ou utilisez sites.json (multi-site)");
  }
  configScript = `<script>window.__CONFIG__=${serialize(cachedConfig, { isJSON: true })}</script>`;
  console.log("Config chargée :", cachedConfig?.meta?.title?.fr || "Config OK");
} else {
  console.log(`[multi-site] ${siteRegistry.size} site(s) chargé(s)`);
}

const app = express();
app.use(express.json({ limit: '5mb' }));
app.use(compression({ level: 6, threshold: 1024 }));
app.set('etag', 'strong');

app.use("/img", createImageOptimizer({
  staticRoot: path.resolve(__dirname, "../dist/client"),
  cacheDir: path.resolve(__dirname, "../.cache/images"),
}));

app.use('/assets', (_req, res, next) => {
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  next();
});

app.use('/images', (_req, res, next) => {
  res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
  next();
});

app.use('/css', (_req, res, next) => {
  res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
  next();
});

app.use(express.static(path.resolve(__dirname, "../dist/client"), {
  index: false, etag: true, lastModified: true,
}));

app.use((req, res, next) => {
  if (req.url.match(/\.(png|jpg|jpeg|gif|svg|css|js|json|ico|webp|mp4|woff2|woff)$/)) return res.status(404).end();
  next();
});

app.post("/api/admin/upload-image", createImageUpload({
  staticRoot: path.resolve(__dirname, "../dist/client"),
}));

let renderModule = null;
async function getRender() {
  if (!renderModule) renderModule = await import("../dist/server/entry-server.js");
  return renderModule.render;
}

async function renderSite(req, res, config, slug, cfgScript) {
  try {
    const template = fs.readFileSync(path.resolve(__dirname, "../dist/client/index.html"), "utf-8");

    const envScript = `<script>window.__ENV__={
      VITE_BASE_URL_BACKEND:${JSON.stringify(process.env.VITE_BASE_URL_BACKEND || "")},
      VITE_SERVER_URL:${JSON.stringify(process.env.VITE_SERVER_URL || "")},
      VITE_SLUG:${JSON.stringify(slug || process.env.VITE_SLUG || "")}
    }</script>`;

    // Inject site CSS via <link> — compiled files in dist/client/css/
    const cssName = resolveCssForSlug(slug || process.env.VITE_SLUG) || getDefaultCss();
    const cssLink = cssName ? `<link rel="stylesheet" href="/css/${cssName}.css">` : "";

    const [headStart, rest] = template.split("<!--app-head-->");
    const [beforeRoot, tail] = rest.split("<!--app-html-->");

    res.status(200).setHeader("Content-Type", "text/html; charset=utf-8");
    res.write(headStart);
    res.write(cfgScript);
    res.write(envScript);
    res.write(cssLink);

    const render = await getRender();
    await render(req, res, config,
      (helmetHead, dehydratedState) => {
        res.write(helmetHead);
        res.write(`<script>window.__REACT_QUERY_STATE__=${serialize(dehydratedState, { isJSON: true })}</script>`);
        res.write(beforeRoot);
      },
      tail,
    );
  } catch (e) {
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
    const cfgScript = `<script>window.__CONFIG__=${serialize(homepageConfig, { isJSON: true })}</script>`;
    await renderSite(req, res, homepageConfig, null, cfgScript);
  });

  app.use("/s/:slug/{*rest}", async (req, res) => {
    const { slug } = req.params;
    const entry = siteRegistry.get(slug);
    if (!entry) return res.status(404).send(`Site "${slug}" non trouvé. <a href="/">Retour</a>`);
    req.originalUrl = req.originalUrl.replace(`/s/${slug}`, "") || "/";
    await renderSite(req, res, entry.config, slug, entry.configScript);
  });

  app.get("/s/:slug", async (req, res) => {
    const { slug } = req.params;
    const entry = siteRegistry.get(slug);
    if (!entry) return res.status(404).send(`Site "${slug}" non trouvé. <a href="/">Retour</a>`);
    req.originalUrl = "/";
    await renderSite(req, res, entry.config, slug, entry.configScript);
  });
} else {
  app.use(['/{*all}'], async (req, res) => {
    await renderSite(req, res, cachedConfig, singleSlug, configScript);
  });
}

const port = process.env.PORT || 3000;
app.listen(port, () => {
  if (isMultiSite) {
    console.log(`\n🌐 Multi-site production server at http://localhost:${port}`);
    console.log(`   Homepage: http://localhost:${port}/`);
    for (const [slug] of siteRegistry) console.log(`   ${slug}: http://localhost:${port}/s/${slug}`);
  } else {
    console.log(`Production server running at http://localhost:${port}`);
  }
});
