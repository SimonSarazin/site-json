import express from "express";
import { createServer as createViteServer } from "vite";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import serialize from "serialize-javascript";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
      const { demoSiteConfig } = await vite.ssrLoadModule("/src/data/demo-site.ts");
      const cfgScript = `<script>window.__CONFIG__=${serialize(demoSiteConfig, { isJSON:true })}</script>`;

      /* ---- 2. On découpe le template --------------------------------- */
      const [headStart, rest] = template.split("<!--app-head-->");
      const [beforeBody, tail] = rest.split("<!--app-html-->");

      

      /* ---- 3. Envoie du <head> ouvert + config ----------------------- */
      res.status(200).setHeader("Content-Type", "text/html; charset=utf-8");
      res.write(headStart);             // <!doctype … <head>
      res.write(cfgScript);             // script de config — UNIQUEMENT ici

      /* ---- 4. Lance le rendu React ----------------------------------- */
      const { render } = await vite.ssrLoadModule("/src/entry-server.tsx");

      await render(req, res, demoSiteConfig, (helmetHead) => {
        /* callback appelé par entry-server quand Helmet est prêt */
        res.write(helmetHead);          // balises <title>, <meta>, …
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
