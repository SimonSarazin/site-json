import express from "express";
import compression from "compression";
import serveStatic from "serve-static";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import serialize from "serialize-javascript";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(compression());   // gzip
app.use(
  serveStatic(path.resolve(__dirname, "../dist/client"), { index: false })
);

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
      const { demoSiteConfig } = await import("../dist/server/data/demo-site.js");
      const configScript =
        `<script>window.__CONFIG__=${serialize(demoSiteConfig, { isJSON: true })}</script>`;

      // Insère juste avant </head> (ou un marqueur <!--app-head--> si tu en as un)
    const [headStart, rest]   = template.split("<!--app-head-->");
    const [beforeRoot, tail]  = rest.split("<!--app-html-->");

    res.status(200).setHeader("Content-Type", "text/html; charset=utf-8");
    res.write(headStart);           // <!doctype… <head>
    res.write(configScript);           // <script>window.__CONFIG__ = …

    // 3. Import du bundle serveur + streaming
    const { render } = await import("../dist/server/entry-server.js");
    await render(
      req,
      res,
      demoSiteConfig,
      // callback onHead : reçoit les balises Helmet
      (helmetHead) => {
        res.write(helmetHead);      // <title> / <meta> / <link>…
        res.write(beforeRoot);      // </head><body><div id="root">
      },
    );

    // 4. Footer et fermeture
    res.write(tail);                // </div></body></html>
    res.end();
  } catch (e) {
    console.error("SSR Error:", e);
    res.status(500).end("Internal Server Error");
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Production server running at http://localhost:${port}`);
});
