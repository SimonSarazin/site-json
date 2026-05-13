import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import tailwindcss from "@tailwindcss/vite"
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import { visualizer } from 'rollup-plugin-visualizer';
import preloadPlugin from 'vite-preload/plugin';

function buildAllSiteCssPlugin(): Plugin {
  let outDir: string;
  let root: string;

  return {
    name: 'build-all-site-css',
    configResolved(config) {
      outDir = config.build.outDir;
      root = config.root;
    },
    closeBundle() {
      const srcDir = path.resolve(root, 'src');
      const cssOutDir = path.resolve(root, outDir, 'css');

      const cssFiles = fs.readdirSync(srcDir).filter(f => f.startsWith('index-') && f.endsWith('.css'));
      if (cssFiles.length === 0) return;

      fs.mkdirSync(cssOutDir, { recursive: true });

      for (const cssFile of cssFiles) {
        const input = path.resolve(srcDir, cssFile);
        const output = path.resolve(cssOutDir, cssFile);
        try {
          execSync(`npx @tailwindcss/cli -i "${input}" -o "${output}" --minify`, {
            cwd: root,
            stdio: 'pipe',
          });
          console.log(`[site-css] ${cssFile} → css/${cssFile}`);
        } catch (e: unknown) {
          console.error(`[site-css] ${cssFile}:`, (e as Error).message);
        }
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
    preloadPlugin(), // Doit être AVANT react() pour tracer les lazy imports
    react(),
    tailwindcss(),
    // Generate bundle analysis report
    !isSsrBuild && visualizer({
      filename: './dist/stats.html',
      open: false,
      gzipSize: true,
      brotliSize: true,
    }),
    !isSsrBuild && buildAllSiteCssPlugin(),
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