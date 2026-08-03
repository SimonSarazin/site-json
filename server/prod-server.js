import express from "express";
import compression from "compression";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import serialize from "serialize-javascript";
import { createImageOptimizer } from "./middleware/imageOptimizer.js";
import { normalizeSiteConfig } from "./utils/normalizeSiteConfig.js";
import { findSiteBySlug, knownSlugs } from "./utils/sites.js";
import { registerSeoRoutes } from "./lib/sitemap.js";
import { helloassoCheckoutIntentHandler, helloassoTokenHandler, helloassoCallbackHandler, helloassoCheckoutStatusHandler } from "./api/helloasso-checkout.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/* ----------------------------------------------------------------------
 *  Chargement obligatoire de la configuration en production
 * -------------------------------------------------------------------- */
/** Config figée dans le build par SITE_EMBED — cf. siteConfigPlugin (vite.config.ts). */
const BUILT_CONFIG = path.resolve(__dirname, "../dist/site-config.json");

function loadSiteConfig() {
  // 1. JSON inline (variable d'environnement complète)
  if (process.env.SITE_CONFIG_JSON) {
    try {
      return { config: JSON.parse(process.env.SITE_CONFIG_JSON), origin: "SITE_CONFIG_JSON" };
    } catch (e) {
      throw new Error(`SITE_CONFIG_JSON invalide : ${e.message}`);
    }
  }

  // 2. Chemin vers un fichier JSON
  if (process.env.SITE_CONFIG_PATH) {
    const envPath  = process.env.SITE_CONFIG_PATH;
    const filePath = path.isAbsolute(envPath)
      ? envPath
      : path.resolve(process.cwd(), envPath);

    if (fs.existsSync(filePath)) {
      try {
        return { config: JSON.parse(fs.readFileSync(filePath, "utf-8")), origin: `SITE_CONFIG_PATH (${envPath})` };
      } catch (e) {
        // Fichier présent mais illisible ou JSON invalide : vraie erreur.
        throw new Error(`Impossible de lire SITE_CONFIG_PATH : ${e.message}`);
      }
    }

    // Fichier ABSENT. C'est le cas normal sur Coolify, qui pousse le MÊME jeu de
    // variables au build et au run : SITE_CONFIG_PATH a servi à figer la config
    // pendant le build, et le chemin n'existe pas dans l'image (l'étape runner
    // ne copie ni sites.json ni les config.prod.*.json). On bascule alors sur la
    // config figée plutôt que de refuser de démarrer — mais bruyamment, parce
    // qu'un chemin erroné dans un déploiement à volume doit rester visible.
    if (fs.existsSync(BUILT_CONFIG)) {
      console.warn(
        `[config] SITE_CONFIG_PATH "${envPath}" introuvable depuis ${process.cwd()} — ` +
        `bascule sur dist/site-config.json, figée au build. ` +
        `(Attendu si la même variable sert au build et au run ; à corriger si un volume était prévu.)`
      );
    } else {
      throw new Error(
        `Impossible de lire SITE_CONFIG_PATH : "${envPath}" introuvable depuis ${process.cwd()}, ` +
        `et aucune config figée dans dist/site-config.json.`
      );
    }
  }

  // 3. Config embarquée dans l'image au moment du build (SITE_EMBED=true).
  //    C'est une copie conforme du fichier source : même lecture, même
  //    normalisation qu'au niveau 2, seul le chemin change.
  if (fs.existsSync(BUILT_CONFIG)) {
    try {
      return { config: JSON.parse(fs.readFileSync(BUILT_CONFIG, "utf-8")), origin: "dist/site-config.json" };
    } catch (e) {
      throw new Error(`dist/site-config.json illisible : ${e.message}`);
    }
  }

  // 4. VITE_SLUG → sites.json. Ne peut se déclencher qu'EN DEHORS d'un conteneur
  //    (`npm start` depuis le dépôt) : l'étape runner du Dockerfile ne copie ni
  //    sites.json ni les config.prod.*.json. Donne la parité avec dev-server.
  const slug = process.env.VITE_SLUG;
  const site = findSiteBySlug(slug);
  if (site) {
    try {
      const filePath = path.resolve(process.cwd(), site.config);
      return {
        config: JSON.parse(fs.readFileSync(filePath, "utf-8")),
        origin: `sites.json (${slug} → ${site.config})`,
      };
    } catch (e) {
      throw new Error(`Impossible de lire ${site.config} pour le slug "${slug}" : ${e.message}`);
    }
  }

  const slugs = knownSlugs();
  throw new Error(
    "🛑  Aucune configuration trouvée. Quatre voies possibles :\n" +
    "      • SITE_CONFIG_JSON — la configuration complète en variable d'environnement\n" +
    "      • SITE_CONFIG_PATH — le chemin d'un fichier JSON\n" +
    "      • une image construite avec SITE_EMBED=true, qui produit dist/site-config.json\n" +
    "      • VITE_SLUG, si sites.json est présent (lancement depuis le dépôt)" +
    (slug && slugs.length
      ? `\n    VITE_SLUG vaut "${slug}", absent de sites.json — slugs connus : ${slugs.join(", ")}`
      : "")
  );
}

/* ---- Charger la config UNE SEULE FOIS au démarrage -------------------- */
// Normaliser au chargement : pré-sanitize les champs HTML/SVG pour que SSR et
// client utilisent strictement le même contenu (évite mismatch hydration).
const { config: rawSiteConfig, origin: configOrigin } = loadSiteConfig();
const cachedConfig = normalizeSiteConfig(rawSiteConfig);
const configScript = `<script>window.__CONFIG__=${serialize(cachedConfig, { isJSON: true })}</script>`;
console.log(`Config chargée depuis ${configOrigin} :`, cachedConfig?.meta?.title?.fr || "Config OK");

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

    // Passerelle des `VITE_*` vers le CLIENT. En conteneur, `import.meta.env` est
    // vide pour ces clés (aucun ARG côté Dockerfile, et `.env` est exclu du
    // contexte de build) : `window.__ENV__` est donc leur SEULE voie, lue en
    // premier par `readEnv` (src/lib/constant/common.ts). Toute clé de
    // `RuntimeEnv` destinée au navigateur doit figurer ici, sans quoi elle reste
    // visible du SSR (`process.env`) mais pas du client — asymétrie silencieuse.
    // Verrouillé par tests/preflight/runtime-env.test.ts.
    if (
      process.env.VITE_BASE_URL_BACKEND ||
      process.env.VITE_SERVER_URL ||
      process.env.VITE_SLUG ||
      process.env.VITE_MAPTILER_API_KEY ||
      process.env.VITE_COSTUM_FORCE_LIVE
    ) {
      injectEnvScript =
        `<script>
          window.__ENV__ = {
            VITE_BASE_URL_BACKEND: ${JSON.stringify(process.env.VITE_BASE_URL_BACKEND || "")},
            VITE_SERVER_URL: ${JSON.stringify(process.env.VITE_SERVER_URL || "")},
            VITE_SLUG: ${JSON.stringify(process.env.VITE_SLUG || "")},
            VITE_MAPTILER_API_KEY: ${JSON.stringify(process.env.VITE_MAPTILER_API_KEY || "")},
            VITE_COSTUM_FORCE_LIVE: ${JSON.stringify(process.env.VITE_COSTUM_FORCE_LIVE || "")}
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