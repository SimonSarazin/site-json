import express from "express";
import compression from "compression";
import serveStatic from "serve-static";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

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
    const [htmlStart, htmlEnd] = template.split("<!--app-html-->");

    // 2. Envoi immédiat <head>
    res.statusCode = 200;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.write(htmlStart);

    // 3. Import du bundle serveur + streaming
    const { render } = await import("../dist/server/entry-server.js");
    await render(req, res);

    // 4. Footer et fermeture
    res.write(htmlEnd);
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
