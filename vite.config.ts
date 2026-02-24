import path from 'path';
import tailwindcss from "@tailwindcss/vite"
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { visualizer } from 'rollup-plugin-visualizer';
import preloadPlugin from 'vite-preload/plugin';

export default defineConfig(({ mode, isSsrBuild }) => ({
  plugins: [
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
    // Bundler uniquement les packages qui en ont besoin (ESM/CSS)
    // Tout le reste est chargé par Node directement (CJS compatible)
    noExternal: ['@radix-ui/', 'lucide-react'],
    external: [
      'express',
      'compression',
      'serialize-javascript',
      'isomorphic-dompurify',
      '@communecter/cocolight-api-client',
      'sharp'
    ]
  }
}));