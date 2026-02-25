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
      const slug = env.VITE_SLUG;

      if (!slug) {
        console.warn('[site-css] VITE_SLUG non défini dans .env');
        return;
      }

      const sitesPath = path.resolve(config.root, 'sites.json');
      if (!fs.existsSync(sitesPath)) {
        console.warn('[site-css] sites.json non trouvé');
        return;
      }

      const sites = JSON.parse(fs.readFileSync(sitesPath, 'utf-8'));
      const site = sites.find((s: { slug: string }) => s.slug === slug);
      if (!site?.css) {
        console.warn(`[site-css] Pas de CSS pour le slug "${slug}"`);
        return;
      }

      cssFile = path.resolve(config.root, 'src', `${site.css}.css`);
      console.log(`[site-css] ${slug} → src/${site.css}.css`);
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
    external: [
      'react',
      'react-dom',
      'react/jsx-runtime',
      'react/jsx-dev-runtime',
      'react-router',
      'cookie',
      '@tanstack/react-query',
      'express',
      'compression',
      'serialize-javascript',
      'isomorphic-dompurify',
      '@communecter/cocolight-api-client'
    ]
  }
}));