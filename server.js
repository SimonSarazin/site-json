import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';

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
    
    const rendered = await render(siteConfig, url);
    
    // Generate meta tags for SEO
    const metaTags = generateMetaTags(siteConfig, url);
    
    const html = template
      .replace(`<!--app-html-->`, rendered.html)
      .replace(`<!--app-head-->`, metaTags);

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

// Function to generate meta tags for SEO
function generateMetaTags(config, url) {
  const currentPage = config.pages.find(page => page.path === url) || config.pages[0];
  
  const title = currentPage?.seo?.title 
    ? Object.values(currentPage.seo.title)[0]
    : Object.values(currentPage?.title || config.meta.title)[0];
    
  const description = currentPage?.seo?.description
    ? Object.values(currentPage.seo.description)[0]
    : Object.values(config.meta.description || {})[0];
    
  const ogImage = currentPage?.seo?.ogImage || '';
  const canonical = currentPage?.seo?.canonical || `${process.env.SITE_URL || 'http://localhost:5173'}${url}`;
  
  let metaTags = `
    <title>${title}</title>
    <meta name="description" content="${description || ''}" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description || ''}" />
    <meta property="og:url" content="${canonical}" />
    <meta property="og:type" content="${currentPage?.seo?.ogType || 'website'}" />
    <link rel="canonical" href="${canonical}" />
  `;
  
  if (ogImage) {
    metaTags += `<meta property="og:image" content="${ogImage}" />`;
  }
  
  if (currentPage?.seo?.twitterCard) {
    metaTags += `<meta name="twitter:card" content="${currentPage.seo.twitterCard}" />`;
  }
  
  if (currentPage?.seo?.keywords) {
    metaTags += `<meta name="keywords" content="${currentPage.seo.keywords.join(', ')}" />`;
  }
  
  if (currentPage?.seo?.noIndex || currentPage?.seo?.noFollow) {
    const robotsContent = [];
    if (currentPage.seo.noIndex) robotsContent.push('noindex');
    if (currentPage.seo.noFollow) robotsContent.push('nofollow');
    metaTags += `<meta name="robots" content="${robotsContent.join(', ')}" />`;
  }
  
  if (currentPage?.seo?.structuredData) {
    metaTags += `<script type="application/ld+json">${JSON.stringify(currentPage.seo.structuredData)}</script>`;
  }
  
  return metaTags;
}

app.listen(port, () => {
  console.log(`Server started at http://localhost:${port}`);
});