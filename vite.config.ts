import path from 'path';
import fs from 'fs';
import tailwindcss from "@tailwindcss/vite"
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import { visualizer } from 'rollup-plugin-visualizer';
import preloadPlugin from 'vite-preload/plugin';

function siteCssPlugin(): Plugin {
  const virtualId = 'virtual:site-css';
  const resolvedId = '\0' + virtualId;
  let cssFile: string | null = null;

  return {
    name: 'site-css-resolver',
    configResolved(config) {
      const env = loadEnv(config.mode, config.root, '');
      const defaultCss = path.resolve(config.root, 'src', 'index.css');

      // 1. Contenu CSS inline via env (pour CI/CD, Docker build sans fichier dans le repo)
      const cssContent = env.SITE_CSS_CONTENT;
      if (cssContent) {
        const tmpFile = path.resolve(config.root, 'src', '.tmp-site-theme.css');
        fs.writeFileSync(tmpFile, cssContent, 'utf-8');
        cssFile = tmpFile;
        console.log(`[site-css] SITE_CSS_CONTENT → src/.tmp-site-theme.css`);
        return;
      }

      // 2. Chemin CSS explicite (comme SITE_CONFIG_PATH pour la config)
      const cssPath = env.SITE_CSS_PATH;
      if (cssPath) {
        const resolved = path.isAbsolute(cssPath)
          ? cssPath
          : path.resolve(config.root, cssPath);
        if (fs.existsSync(resolved)) {
          cssFile = resolved;
          console.log(`[site-css] SITE_CSS_PATH → ${resolved}`);
          return;
        }
        console.warn(`[site-css] SITE_CSS_PATH "${cssPath}" introuvable, fallback sur default`);
      }

      // 3. Lookup via sites.json + VITE_SLUG
      const slug = env.VITE_SLUG;
      if (slug) {
        const sitesPath = path.resolve(config.root, 'sites.json');
        if (fs.existsSync(sitesPath)) {
          const sites = JSON.parse(fs.readFileSync(sitesPath, 'utf-8'));
          const site = sites.find((s: { slug: string }) => s.slug === slug);
          if (site?.css) {
            const slugCss = path.resolve(config.root, 'src', `${site.css}.css`);
            if (fs.existsSync(slugCss)) {
              cssFile = slugCss;
              console.log(`[site-css] ${slug} → src/${site.css}.css`);
              return;
            }
            console.warn(`[site-css] src/${site.css}.css introuvable pour slug "${slug}", fallback sur default`);
          } else {
            console.warn(`[site-css] Pas de CSS pour le slug "${slug}" dans sites.json, fallback sur default`);
          }
        }
      }

      // 4. Fallback : src/index.css (thème par défaut)
      cssFile = defaultCss;
      console.log(`[site-css] fallback → src/index.css`);
    },
    resolveId(id) {
      if (id === virtualId) return resolvedId;
    },
    load(id) {
      if (id === resolvedId) {
        if (!cssFile) return '/* no site css */';
        return `import "${cssFile}";`;
      }
    },
  };
}

export default defineConfig(({ mode, isSsrBuild }) => ({
  server: {
    allowedHosts: true,
    warmup: {
      ssrFiles: ['./src/entry-server.tsx'],
      clientFiles: ['./src/entry-client.tsx'],
    },
  },
  plugins: [
    siteCssPlugin(),
    preloadPlugin(), // Doit être AVANT react() pour tracer les lazy imports
    react(),
    tailwindcss(),
    // Generate bundle analysis report
    !isSsrBuild && visualizer({
      filename: './dist/stats.html',
      open: false,
      gzipSize: true,
      brotliSize: true,
    })
  ].filter(Boolean),
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(mode),
  },
  esbuild: {
    jsx: 'automatic',
    jsxDev: false,
  },
  build: {
    manifest: true, // Génère le manifest.json pour vite-preload
    rollupOptions: isSsrBuild ? {
      input: 'src/entry-server.tsx',
      output: {
        format: 'es'
      }
    } : {
      output: {
        manualChunks: (id) => {
          // React core libraries
          if (id.includes('node_modules/react/') ||
              id.includes('node_modules/react-dom/') ||
              id.includes('node_modules/react-router')) {
            return 'react-vendor';
          }

          // Radix UI components
          if (id.includes('node_modules/@radix-ui/')) {
            return 'ui-vendor';
          }

          // TanStack Query
          if (id.includes('node_modules/@tanstack/react-query')) {
            return 'query-vendor';
          }

          // Lucide React icons - separate chunk for icons
          if (id.includes('node_modules/lucide-react/')) {
            return 'icons-vendor';
          }

          // Utility libraries
          if (id.includes('node_modules/clsx') ||
              id.includes('node_modules/tailwind-merge') ||
              id.includes('node_modules/class-variance-authority') ||
              id.includes('node_modules/date-fns')) {
            return 'utils-vendor';
          }

          // i18n libraries - react-i18next depends on React context, keep in main bundle
          if (id.includes('node_modules/i18next') &&
              !id.includes('node_modules/react-i18next')) {
            return 'i18n-vendor';
          }
          // react-i18next stays in main bundle to avoid initialization issues

          // Form libraries
          if (id.includes('node_modules/react-hook-form') ||
              id.includes('node_modules/zod') ||
              id.includes('node_modules/@hookform')) {
            return 'form-vendor';
          }

          // Recharts has circular dependencies - keep in main bundle or with react
          // Do not separate recharts to avoid initialization issues

          if (id.includes('node_modules/leaflet') ||
              id.includes('node_modules/leaflet.markercluster')) {
            return 'maps-vendor';
          }

          if (id.includes('node_modules/markdown-it')) {
            return 'markdown-vendor';
          }

          if (id.includes('node_modules/dompurify') ||
              id.includes('node_modules/isomorphic-dompurify')) {
            return 'sanitize-vendor';
          }

          // Communecter API client
          if (id.includes('node_modules/@communecter/cocolight-api-client')) {
            return 'api-vendor';
          }
        }
      }
    }
  },
  ssr: {
    noExternal: isSsrBuild ? true : undefined,
    external: isSsrBuild
      ? [
          'express',
          'compression',
          'serialize-javascript',
          'isomorphic-dompurify',
          '@communecter/cocolight-api-client',
          'sharp',
          'pino',
          'pino-pretty',
          'react',
          'react-dom',
          'react/jsx-runtime',
          'react/jsx-dev-runtime',
        ]
      : [
          '@communecter/cocolight-api-client',
          'pino',
          'pino-pretty',
        ],
  }
}));