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
    appType: 'custom',
    ssr: {
      noExternal: ['@radix-ui/*', 'lucide-react', '@communecter/cocolight-api-client']
    }
  });

  // Use vite's connect instance as middleware
  app.use(vite.middlewares);

  app.use('*', async (req, res, next) => {
    const url = req.originalUrl;

    try {
      // 1. Read index.html
      let template = fs.readFileSync(
        path.resolve(__dirname, '../index.html'),
        'utf-8'
      );

      // 2. Apply Vite HTML transforms
      template = await vite.transformIndexHtml(url, template);

      // 3. Load the server entry
      const { render } = await vite.ssrLoadModule('/src/entry-server.tsx');

      // 4. Render the app HTML
      const { html: appHtml, context } = await render(url);

      // 5. Inject the app-rendered HTML into the template
      const html = template.replace('<!--app-html-->', appHtml);

      // 6. Send the rendered HTML back
      res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
    } catch (e) {
      // If an error is caught, let Vite fix the stack trace so it maps back to
      // your actual source code.
      vite.ssrFixStacktrace(e);
      console.error('SSR Error:', e);
      res.status(500).end('Internal Server Error');
    }
  });

  const port = process.env.PORT || 5173;
  app.listen(port, () => {
    console.log(`SSR Dev server running at http://localhost:${port}`);
  });
}

createServer().catch(console.error);