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

/** Taille cumulée d'un dossier, en octets — sert uniquement aux logs. */
function dirSize(dir: string): number {
  let total = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    total += entry.isDirectory() ? dirSize(full) : fs.statSync(full).size;
  }
  return total;
}

const mo = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} Mo`;

/**
 * `SITE_IMAGES` — n'embarquer dans le build que les dossiers d'images du site.
 *
 * `public/images/` contient un dossier par site (13 aujourd'hui, ~40 Mo), tous
 * recopiés dans `dist/client/` puis dans chaque image Docker. Cette variable
 * prend un NOM DE DOSSIER (pas un chemin), ou plusieurs séparés par des
 * virgules : `SITE_IMAGES=institutBleu`.
 *
 * Le nom du dossier n'est pas déductible du slug — `navigatorDesTierslieux`
 * utilise `tiersLieux`, et six slugs communaux partagent `communeTransparente`.
 * C'est le champ `images` de `sites.json` qui documente la correspondance.
 *
 * Seuls les sous-dossiers DIRECTS de `public/images/` sont filtrés ; tout le
 * reste de `public/` est copié tel quel. C'est ce qui dispense d'une liste
 * blanche : `defaultImage.png` (câblé en dur dans les composants de recherche),
 * `marker-icon.png` et `marker-shadow.png` (consommés par Leaflet, invisibles
 * au grep) et `france-regions.geojson` sont des FICHIERS, donc conservés.
 *
 * Trois cas de repli, tous en no-op bruyant plutôt qu'en erreur — un site sans
 * visuels se déploie sans rien casser, donc le silence est le vrai danger :
 * variable absente, dossier nommé introuvable, `public/images/` inexistant.
 */
function siteImagesPlugin(): Plugin {
  let keep: Set<string> | null = null;
  let publicDir: string | null = null;
  let outDir = '';

  return {
    name: 'site-images-selector',
    apply: 'build',

    config(userConfig, env) {
      // Le build SSR ne copie déjà plus publicDir (cf. build.copyPublicDir).
      if (env.isSsrBuild) return;

      const root = path.resolve(userConfig.root ?? process.cwd());
      const raw = loadEnv(env.mode, root, '').SITE_IMAGES?.trim();
      if (!raw) return; // Vite copie publicDir en entier, comportement historique

      const pub = userConfig.publicDir === false
        ? null
        : path.resolve(root, userConfig.publicDir ?? 'public');
      const imagesRoot = pub ? path.join(pub, 'images') : null;

      if (!imagesRoot || !fs.existsSync(imagesRoot)) {
        console.warn(`[site-images] public/images/ introuvable → aucun filtrage`);
        return;
      }

      const available = fs
        .readdirSync(imagesRoot, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => e.name);

      const wanted = raw.split(',').map((s) => s.trim()).filter(Boolean);
      const missing = wanted.filter((w) => !available.includes(w));
      if (missing.length) {
        console.warn(
          `[site-images] ${missing.map((m) => `"${m}"`).join(', ')} introuvable(s) dans public/images/ → aucun filtrage\n` +
          `              disponibles : ${available.join(', ')}`,
        );
        return; // mieux vaut une image complète qu'un site sans visuels
      }

      keep = new Set(wanted);
      return { build: { copyPublicDir: false } };
    },

    configResolved(resolved) {
      if (!keep) return;
      publicDir = resolved.publicDir || null;
      outDir = path.resolve(resolved.root, resolved.build.outDir);
    },

    closeBundle() {
      if (!keep || !publicDir) return;
      const src = publicDir;
      const prefix = `images${path.sep}`;
      const dropped: string[] = [];

      fs.cpSync(src, outDir, {
        recursive: true,
        filter: (from) => {
          const rel = path.relative(src, from);
          if (!rel.startsWith(prefix)) return true; // hors images/ : tout passe
          const seg = rel.slice(prefix.length);
          if (seg.includes(path.sep)) return true; // sous le niveau déjà tranché
          if (!fs.statSync(from).isDirectory()) return true; // fichier de images/
          if (keep!.has(seg)) return true;
          dropped.push(seg);
          return false;
        },
      });

      const kept = [...keep]
        .map((name) => `${name} (${mo(dirSize(path.join(src, 'images', name)))})`)
        .join(', ');
      const droppedSize = dropped.reduce((sum, name) => sum + dirSize(path.join(src, 'images', name)), 0);
      console.log(
        `[site-images] ${kept} — ${dropped.length} dossier(s) écarté(s) (${mo(droppedSize)})`,
      );
    },
  };
}

const isTruthy = (value?: string) =>
  value !== undefined && ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());

/**
 * `SITE_EMBED` — figer la config du site dans le build.
 *
 * `SITE_CONFIG_PATH` et `SITE_CONFIG_JSON` ont déjà un sens À L'EXÉCUTION dans
 * tous les déploiements existants : prod-server les lit au démarrage. Les
 * consommer au build sur simple présence changerait donc le comportement de
 * l'existant en silence. D'où ce drapeau, qui rend la lecture au build opt-in.
 * (`SITE_IMAGES` n'a pas ce problème : elle est nouvelle, sa seule présence
 * suffit.)
 *
 * Le fichier produit, `dist/site-config.json`, est une COPIE CONFORME de sa
 * source — ni normalisation, ni métadonnées ajoutées. Il reste donc une
 * `SiteConfig` valide : comparable par `diff`, validable par `config:validate`,
 * utilisable tel quel via `SITE_CONFIG_PATH`.
 *
 * Il est écrit à la racine de `dist/`, pas dans `dist/client/` (que
 * `express.static` sert publiquement et que les CDN mettraient en cache) ni dans
 * `dist/server/` (que le build SSR, exécuté ensuite, viderait). Le
 * `COPY --from=builder /app/dist ./dist` du Dockerfile l'emporte au passage :
 * aucune ligne à y ajouter.
 *
 * Aucun repli : ni sur `sites.json`, ni sur `config.prod.json`. Figer une config
 * arbitraire serait pire que ne rien figer — prod-server retombe alors sur ses
 * niveaux 1 et 2, comportement historique.
 */
function siteConfigPlugin(): Plugin {
  let source: { file: string | null; inline: string | null; label: string } | null = null;
  let outFile = "";

  return {
    name: 'site-config-materializer',
    apply: 'build',

    configResolved(config) {
      if (config.build.ssr) return; // écrit une seule fois, pendant le build client

      const env = loadEnv(config.mode, config.root, '');
      if (!isTruthy(env.SITE_EMBED)) return;

      const distRoot = path.dirname(path.resolve(config.root, config.build.outDir));
      if (distRoot === path.resolve(config.root)) {
        console.warn(
          `[site-config] outDir inattendu ("${config.build.outDir}", attendu "dist/client") → rien n'est figé`,
        );
        return;
      }
      outFile = path.join(distRoot, 'site-config.json');

      if (env.SITE_CONFIG_JSON) {
        source = { file: null, inline: env.SITE_CONFIG_JSON, label: 'SITE_CONFIG_JSON' };
        return;
      }

      if (env.SITE_CONFIG_PATH) {
        const file = path.isAbsolute(env.SITE_CONFIG_PATH)
          ? env.SITE_CONFIG_PATH
          : path.resolve(config.root, env.SITE_CONFIG_PATH);
        if (!fs.existsSync(file)) {
          console.warn(`[site-config] SITE_CONFIG_PATH "${env.SITE_CONFIG_PATH}" introuvable → rien n'est figé`);
          return;
        }
        source = { file, inline: null, label: path.relative(config.root, file) };
        return;
      }

      console.warn(
        `[site-config] SITE_EMBED actif mais ni SITE_CONFIG_JSON ni SITE_CONFIG_PATH → rien n'est figé`,
      );
    },

    closeBundle() {
      if (!source) return;

      if (source.inline !== null) {
        try {
          JSON.parse(source.inline);
        } catch (e) {
          console.warn(`[site-config] SITE_CONFIG_JSON invalide (${(e as Error).message}) → rien n'est figé`);
          return;
        }
        fs.writeFileSync(outFile, source.inline, 'utf-8');
      } else {
        fs.copyFileSync(source.file as string, outFile);
      }

      console.log(`[site-config] ${source.label} → dist/site-config.json`);
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
    siteImagesPlugin(),
    siteConfigPlugin(),
    preloadPlugin(), // Doit être AVANT react() pour tracer les lazy imports
    react(),
    tailwindcss(),
    // Generate bundle analysis report
    // Hors `dist/` : le Dockerfile copie `dist/` en entier dans l'image de prod,
    // et le rapport (~4 Mo) n'a rien à y faire.
    !isSsrBuild && visualizer({
      filename: './stats.html',
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
    // Le build SSR recopiait `public/` dans `dist/server/` (~43 Mo d'images et de
    // geojson) alors que rien ne l'y sert : prod-server ne lit de ce dossier que
    // `entry-server.js`, et `express.static` comme l'optimiseur d'images pointent
    // sur `dist/client`. Seul le build client copie publicDir.
    copyPublicDir: !isSsrBuild,
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

          // Lucide React : pas de manualChunks → Vite décide.
          // Les icônes individuelles chargées via `lucide-react/dynamic`
          // (`DynamicIcon`) sont chunkées à la demande (1 chunk par icône),
          // les icônes nommées statiquement sont tree-shakées vers le chunk
          // qui les utilise. Plus économe que tout regrouper dans
          // `icons-vendor` (qui forçait ~1900 icônes via le manifest dynamic).

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

          // Carte Leaflet (module profil — ProfileMapLeaflet). Chunk SÉPARÉ de
          // MapLibre : une fiche profil ne doit pas tirer tout le SDK MapTiler.
          if (id.includes('node_modules/leaflet') ||
              id.includes('node_modules/leaflet.markercluster')) {
            return 'maps-vendor';
          }

          // Carte MapLibre/MapTiler (module search — SearchMap) + supercluster.
          // Lazy (SearchMapWrapper) et isolée du chunk Leaflet ci-dessus.
          if (id.includes('node_modules/maplibre-gl') ||
              id.includes('node_modules/react-map-gl') ||
              id.includes('node_modules/@vis.gl/react-maplibre') ||
              id.includes('node_modules/@maptiler/') ||
              id.includes('node_modules/supercluster') ||
              id.includes('node_modules/kdbush')) {
            return 'maplibre-vendor';
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