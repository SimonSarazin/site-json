import express from 'express';
import { createServer as createViteServer } from 'vite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function createServer() {
  const app = express();

  // Create Vite server in middleware mode
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'custom'
  });

  // Use vite's connect instance as middleware
  app.use(vite.ssrLoadModule);

  app.use('*', async (req, res, next) => {
    const url = req.originalUrl;

    try {
      // 1. Read index.html
      let template = fs.readFileSync(
        path.resolve(__dirname, 'template.html'),
        'utf-8'
      );

      // 2. Apply Vite HTML transforms
      template = await vite.transformIndexHtml(url, template);

      // 3. Load the server entry
      const { render } = await vite.ssrLoadModule('/src/entry-server.tsx');

      // 4. Render the app HTML
      const { html: appHtml, context } = render(url);

      // 5. Inject the app-rendered HTML into the template
      const html = template
        .replace('<!--title-->', 'Complete JSON-Driven Site Renderer')
        .replace('<!--app-html-->', appHtml)
        .replace('<!--head-->', '')
        .replace('<!--scripts-->', '<script type="module" src="/src/entry-client.tsx"></script>');

      // 6. Send the rendered HTML back
      res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
    } catch (e) {
      // If an error is caught, let Vite fix the stack trace so it maps back to
      // your actual source code.
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });

  const port = process.env.PORT || 5173;
  app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
  });
}

createServer();