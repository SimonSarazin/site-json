import express from "express";
import compression from "compression";
import serveStatic from "serve-static";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import serialize from "serialize-javascript";

// import dotenv from "dotenv";
// dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(compression());   // gzip
app.use(
  serveStatic(path.resolve(__dirname, "../dist/client"), { index: false })
);

/* ----------------------------------------------------------------------
 *  Chargement obligatoire de la configuration en production
 * -------------------------------------------------------------------- */
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

// SSR universel
app.use(['/{*all}'], async (req, res) => {
  try {
    const url = req.originalUrl;

    // 1. Template pré-buildé
    const template = fs.readFileSync(
      path.resolve(__dirname, "../dist/client/index.html"),
      "utf-8"
    );

      // --- Injection de la config -------------------------------------------------
    // 2. Chargement + injection de la configuration
    const siteConfig = await loadSiteConfig();
    const configScript = `<script>window.__CONFIG__=${serialize(siteConfig, {
      isJSON: true,
    })}</script>`;

    let injectEnvScript = "";

    if (process.env.VITE_BASE_URL_BACKEND || process.env.VITE_SERVER_URL || process.env.VITE_SLUG) {
      injectEnvScript = 
        `<script>
          window.__ENV__ = {
            VITE_BASE_URL_BACKEND: ${JSON.stringify(process.env.VITE_BASE_URL_BACKEND || "")},
            VITE_SERVER_URL: ${JSON.stringify(process.env.VITE_SERVER_URL || "")},
            VITE_SLUG: ${JSON.stringify(process.env.VITE_SLUG || "")}
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
      siteConfig,
      // callback onHead : reçoit les balises Helmet
      (helmetHead, dehydratedState) => {
        res.write(helmetHead);      // <title> / <meta> / <link>…
        res.write(`<script>window.__REACT_QUERY_STATE__=${serialize(
                            dehydratedState, { isJSON: true }
                          )}</script>`);
        res.write(beforeRoot);      // </head><body><div id="root">
      },
    );

  } catch (e) {
    console.error("SSR Error:", e);
    res.status(500).end("Internal Server Error");
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Production server running at http://localhost:${port}`);
});