import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { initApiClient } from './src/lib/apiClient.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isProduction = process.env.NODE_ENV === 'production';
const port = process.env.PORT || 5173;
const base = process.env.BASE || '/';

// Cached production assets
const templateHtml = isProduction
  ? fs.readFileSync('./dist/client/index.html', 'utf-8')
  : '';
const ssrManifest = isProduction
  ? fs.readFileSync('./dist/client/.vite/ssr-manifest.json', 'utf-8')
  : undefined;

// Create http server
const app = express();

// Add Vite or respective production middlewares
let vite;
if (!isProduction) {
  const { createServer } = await import('vite');
  vite = await createServer({
    server: { middlewareMode: true },
    appType: 'custom',
    base
  });
  app.use(vite.ssrLoadModule);
} else {
  const compression = (await import('compression')).default;
  const sirv = (await import('sirv')).default;
  app.use(compression());
  app.use(base, sirv('./dist/client', { extensions: [] }));
}

// Serve HTML
app.use('*', async (req, res) => {
  try {
    const url = req.originalUrl.replace(base, '');

    let template;
    let render;
    if (!isProduction) {
      // Always read fresh template in development
      template = fs.readFileSync('./index.html', 'utf-8');
      template = await vite.transformIndexHtml(url, template);
      render = (await vite.ssrLoadModule('/src/entry-server.tsx')).render;
    } else {
      template = templateHtml;
      render = (await import('./dist/server/entry-server.js')).render;
    }

    // Load site configuration (you might want to load this from a database or file)
    const siteConfig = await loadSiteConfig();
    
    // Initialize API client to get user and organization data
    let initialMe = null;
    let initialOrganization = null;
    
    try {
      const { me, organization } = await initApiClient();
      initialMe = me;
      initialOrganization = organization;
    } catch (error) {
      console.log('Failed to initialize API client on server:', error.message);
      // Continue with null values - this is expected when not authenticated
    }
    
    const { html: rendered, helmet } = await render(siteConfig, url, initialMe, initialOrganization);
    
    // Extract helmet data for SEO
    const metaTags = helmet ? [
      helmet.title?.toString() || '',
      helmet.meta?.toString() || '',
      helmet.link?.toString() || '',
      helmet.script?.toString() || ''
    ].join('\n') : '';
    
    // Serialize initial state for client-side hydration
    const initialState = {
      siteConfig,
      url,
      initialMe,
      initialOrganization
    };
    
    const initialStateScript = `<script>window.__APP_INITIAL_STATE__ = ${JSON.stringify(initialState).replace(/</g, '\\u003c')};</script>`;
    
    const html = template
      .replace(`<!--app-html-->`, rendered)
      .replace(`<!--app-head-->`, metaTags + '\n' + initialStateScript);

    res.status(200).set({ 'Content-Type': 'text/html' }).send(html);
  } catch (e) {
    vite?.ssrFixStacktrace(e);
    console.log(e.stack);
    res.status(500).end(e.stack);
  }
});

// Function to load site configuration
async function loadSiteConfig() {
  // In a real application, you might load this from a database or API
  const { demoSiteConfig } = await import('./src/data/demo-site.js');
  return demoSiteConfig;
}

app.listen(port, () => {
  console.log(`Server started at http://localhost:${port}`);
});