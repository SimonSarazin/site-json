import express from "express";
import compression from "compression";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import serialize from "serialize-javascript";
import { createImageOptimizer } from "./middleware/imageOptimizer.js";
import { normalizeSiteConfig } from "./utils/normalizeSiteConfig.js";
import { registerSeoRoutes } from "./lib/sitemap.js";
import { helloassoCheckoutIntentHandler, helloassoTokenHandler, helloassoCallbackHandler, helloassoCheckoutStatusHandler } from "./api/helloasso-checkout.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/* ----------------------------------------------------------------------
 *  Chargement obligatoire de la configuration en production
 * -------------------------------------------------------------------- */
function loadSiteConfig() {
  // 1. JSON inline (variable d'environnement complète)
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

  // Si nous sommes en production et rien n'a été fourni :
  throw new Error(
    "🛑  Aucune configuration trouvée : définissez SITE_CONFIG_JSON ou SITE_CONFIG_PATH (obligatoire en production)"
  );
}

/* ---- Charger la config UNE SEULE FOIS au démarrage -------------------- */
// Normaliser au chargement : pré-sanitize les champs HTML/SVG pour que SSR et
// client utilisent strictement le même contenu (évite mismatch hydration).
const cachedConfig = normalizeSiteConfig(loadSiteConfig());
const configScript = `<script>window.__CONFIG__=${serialize(cachedConfig, { isJSON: true })}</script>`;
console.log("Config chargée :", cachedConfig?.meta?.title?.fr || "Config OK");

const app = express();

// Compression gzip avec options optimisées
app.use(compression({
  level: 6,        // Bon compromis vitesse/compression
  threshold: 1024, // Minimum 1KB pour compresser
}));

// ETag pour requêtes conditionnelles (304 Not Modified)
app.set('etag', 'strong');

// Image optimizer — must be before express.static
app.use("/img", createImageOptimizer({
  staticRoot: path.resolve(__dirname, "../dist/client"),
  cacheDir: path.resolve(__dirname, "../.cache/images"),
}));


// Middleware JSON pour les requêtes API
app.use(express.json());

// Routes API HelloAsso
console.log("🔧 Enregistrement des routes API HelloAsso...");
app.get("/api/helloasso/token", helloassoTokenHandler);
app.post("/api/helloasso/checkout-intent", helloassoCheckoutIntentHandler);
app.get("/api/helloasso/callback", helloassoCallbackHandler);
app.get("/api/helloasso/checkout-status/:checkoutIntentId", helloassoCheckoutStatusHandler);

// Flux RSS des articles blog (SEO/distribution). costumSlug : ?costum= > config.blog.feedCostumSlug > env.
app.get("/blog/feed.xml", async (req, res) => {
  try {
    const slug = req.query.costum || cachedConfig?.blog?.feedCostumSlug || process.env.VITE_FEED_COSTUM_SLUG;
    if (!slug) { res.status(400).type("application/xml").send('<?xml version="1.0"?><error>costumSlug manquant (?costum=slug ou config.blog.feedCostumSlug)</error>'); return; }
    const { renderBlogFeed } = await import("../dist/server/entry-server.js");
    const title = cachedConfig?.meta?.title?.fr || cachedConfig?.meta?.title || "Articles";
    const xml = await renderBlogFeed({ costumSlug: String(slug), title });
    res.type("application/rss+xml").send(xml);
  } catch (e) {
    console.error("[blog-feed]", e);
    res.status(500).type("application/xml").send('<?xml version="1.0"?><error>erreur flux</error>');
  }
});

// SEO : robots.txt + sitemap.xml générés depuis la config — avant les statiques
// et le fallback SSR (sinon le SSR rendrait du HTML sur ces URLs).
registerSeoRoutes(app, () => cachedConfig);

// Cache long terme pour assets hashés Vite (1 an, immutable)
app.use('/assets', (req, res, next) => {
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  next();
});

// Cache moyen terme pour images statiques (1 jour + revalidation 7 jours)
app.use('/images', (req, res, next) => {
  res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
  next();
});

// Servir les fichiers statiques avec ETag et Last-Modified
app.use(
  express.static(path.resolve(__dirname, "../dist/client"), {
    index: false,
    etag: true,
    lastModified: true,
  })
);

// 404 pour requêtes de fichiers statiques inexistants
app.use((req, res, next) => {
  // Exclure les routes API
  if (req.url.startsWith("/api/")) {
    return next();
  }

  if (req.url.match(/\.(png|jpg|jpeg|gif|svg|css|js|json|ico|webp|mp4|woff2|woff)$/)) {
    return res.status(404).end();
  }
  next();
});

// SSR universel
app.use(['/{*all}'], async (req, res) => {
  try {
    const url = req.originalUrl;

    // 1. Template pré-buildé
    const template = fs.readFileSync(
      path.resolve(__dirname, "../dist/client/index.html"),
      "utf-8"
    );

    let injectEnvScript = "";

    if (process.env.VITE_BASE_URL_BACKEND || process.env.VITE_SERVER_URL || process.env.VITE_SLUG || process.env.VITE_MAPTILER_API_KEY) {
      injectEnvScript =
        `<script>
          window.__ENV__ = {
            VITE_BASE_URL_BACKEND: ${JSON.stringify(process.env.VITE_BASE_URL_BACKEND || "")},
            VITE_SERVER_URL: ${JSON.stringify(process.env.VITE_SERVER_URL || "")},
            VITE_SLUG: ${JSON.stringify(process.env.VITE_SLUG || "")},
            VITE_MAPTILER_API_KEY: ${JSON.stringify(process.env.VITE_MAPTILER_API_KEY || "")}
          };
        </script>
      `;
    }

      // Insère juste avant </head> (ou un marqueur <!--app-head--> si tu en as un)
    const [headStart, rest]   = template.split("<!--app-head-->");
    const [beforeRoot, tail]  = rest.split("<!--app-html-->");
    

    res.status(200).setHeader("Content-Type", "text/html; charset=utf-8");
    res.write(headStart);           // <!doctype… <head>
    res.write(configScript);           // <script>window.__CONFIG__ = …
    res.write(injectEnvScript);     // <script>window.__ENV__ = …

    // 3. Import du bundle serveur + streaming
    const { render } = await import("../dist/server/entry-server.js");
    await render(
      req,
      res,
      cachedConfig,
      // callback onHead : reçoit les balises Helmet
      (helmetHead, dehydratedState) => {
        const stateScript = `<script>window.__REACT_QUERY_STATE__=${serialize(
                            dehydratedState, { isJSON: true }
                          )}</script>`;

        res.write(helmetHead);      // <title> / <meta> / <link>…
        res.write(stateScript);
        res.write(beforeRoot);      // </head><body><div id="root">
      },
      tail,  // closing tags from template
    );

    // Fermer explicitement la réponse après le streaming (cf. fix 30ed931 —
    // sans ce res.end() le browser reste en readyState "loading" et le
    // bundle entry-client ne s'exécute jamais → loader infini au cold start)
    if (!res.writableEnded) {
      res.end();
    }

  } catch (e) {
    // Ignorer les erreurs de stream fermé (client déconnecté en cours de stream)
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
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Production server running at http://localhost:${port}`);
});