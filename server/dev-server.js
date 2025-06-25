import express from "express";
import { createServer as createViteServer } from "vite";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function createServer() {
  const app = express();

  // Vite en middleware
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: "custom",
    ssr: {
      noExternal: ["@radix-ui/*", "lucide-react", "@communecter/cocolight-api-client"],
    },
  });

  app.use(vite.middlewares);

  // SSR universel
  app.use(['/{*all}'], async (req, res) => {
    try {
      const url = req.originalUrl;

      // 1. HTML de base (transformé par Vite pour injecter scripts / HMR)
      let template = fs.readFileSync(path.resolve(__dirname, "../index.html"), "utf-8");
      template = await vite.transformIndexHtml(url, template);

      // 2. Découpe autour du placeholder <!--app-html-->
      const [htmlStart, htmlEnd] = template.split("<!--app-html-->");

      // 3. Envoi immédiat du DOCTYPE + <head>
      res.statusCode = 200;
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.write(htmlStart);

      // 4. Import du module SSR en streaming
      const { render } = await vite.ssrLoadModule("/src/entry-server.tsx");
      await render(req, res);          // React stream ici

      // 5. Fin du document
      res.write(htmlEnd);
      res.end();
    } catch (e) {
      vite.ssrFixStacktrace(e);
      console.error("SSR Error:", e);
      res.status(500).end("Internal Server Error");
    }
  });

  const port = process.env.PORT || 5173;
  app.listen(port, () => {
    console.log(`SSR Dev server running at http://localhost:${port}`);
  });
}

createServer().catch(console.error);
