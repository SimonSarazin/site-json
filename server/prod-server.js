import express from 'express';
import compression from 'compression';
import serveStatic from 'serve-static';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

// Enable gzip compression
app.use(compression());

// Serve static files
app.use(serveStatic(path.resolve(__dirname, '../dist/client'), {
  index: false
}));

// SSR handler
app.use('*', async (req, res, next) => {
  const url = req.originalUrl;

  try {
    // Read the built template
    const template = fs.readFileSync(
      path.resolve(__dirname, '../dist/client/index.html'),
      'utf-8'
    );

    // Import the server entry
    const { render } = await import('../dist/server/entry-server.js');

    // Render the app
    const { html: appHtml, context, head } = render(url);

    // Replace the placeholder with the rendered HTML
    const html = template.replace("<!--app-head-->", `${head ?? ""}`)
      .replace('<!--app-html-->', appHtml);

    res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
  } catch (e) {
    console.error(e);
    res.status(500).end(e.message);
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Production server running at http://localhost:${port}`);
});