[← Retour à l'index](README.md)

# Backend et SSR

**Sommaire**

- [Backend et SSR](#backend-et-ssr)
  - [`server/dev-server.js`](#serverdev-serverjs)
    - [Middleware d'upload d'images](#middleware-dupload-dimages)
    - [Config: chargement et cache](#config-chargement-et-cache)
    - [Config: hot-reload et sauvegarde WebSocket](#config-hot-reload-et-sauvegarde-websocket)
  - [`server/prod-server.js`](#serverprod-serverjs)
  - [`src/entry-server.tsx`](#srcentry-servertsx)
    - [Intégration vite-preload](#intégration-vite-preload)
    - [Extraction des ressources critiques](#extraction-des-ressources-critiques)
    - [Pattern Transform stream](#pattern-transform-stream)
  - [`src/entry-client.tsx` - Hydratation avec detection Sync/Async](#srcentry-clienttsx---hydratation-avec-detection-syncasync)
    - [Import CSS virtuel](#import-css-virtuel)
    - [Gestion du loader et des stylesheets](#gestion-du-loader-et-des-stylesheets)
    - [HMR config reload](#hmr-config-reload)
    - [Déclarations globales TypeScript](#déclarations-globales-typescript)
    - [Récupération de la config et du state](#récupération-de-la-config-et-du-state)
    - [BuildRoutes avec détection Sync/Async](#buildroutes-avec-détection-syncasync)
    - [Composant Root avec gestion Sync/Async](#composant-root-avec-gestion-syncasync)
    - [Avantage de ce pattern](#avantage-de-ce-pattern)
    - [Hydratation React Query](#hydratation-react-query)
    - [Hydratation Helmet (meta tags)](#hydratation-helmet-meta-tags)
    - [Point d'entrée final](#point-dentrée-final)
    - [Initialisation i18n](#initialisation-i18n)
  - [Pattern SSR Loader - Pre-fetching des données](#pattern-ssr-loader---pre-fetching-des-données)
    - [Principe du SSR Loader](#principe-du-ssr-loader)
    - [Anatomie d'un loader](#anatomie-dun-loader)
    - [Détection côté serveur vs client](#détection-côté-serveur-vs-client)
    - [Utilisation de ensureQueryData](#utilisation-de-ensurequerydata)
    - [Gestion des erreurs dans les loaders](#gestion-des-erreurs-dans-les-loaders)
    - [Désérialisation de l'état React Query](#désérialisation-de-létat-react-query)
    - [Pattern avec initApi singleton](#pattern-avec-initapi-singleton)
    - [Exemple complet: Module Profil](#exemple-complet-module-profil)
    - [Optimisations avancées](#optimisations-avancées)
    - [Limitations et considérations](#limitations-et-considérations)
  - [Voir aussi](#voir-aussi)

---

Cette section décrit en détail le fonctionnement des fichiers responsables du serveur de développement, du serveur de production, ainsi que des points d'entrée SSR et client.

---

## `server/dev-server.js`

1. **Chargement des variables d'environnement**

   ```js
   import dotenv from "dotenv";
   dotenv.config();
   ```

2. **Middleware d'optimisation d'images**

   ```js
   import { createImageOptimizer } from "./middleware/imageOptimizer.js";
   app.use("/img", createImageOptimizer({
     staticRoot: path.resolve(__dirname, "../public"),
     cacheDir: path.resolve(__dirname, "../.cache/images"),
   }));
   ```

   * Monte **avant** les middlewares Vite pour intercepter les requetes `/img`
   * `staticRoot` pointe vers `public/` en dev

### Middleware d'upload d'images

   ```js
   import { createImageUpload } from "./middleware/imageUpload.js";
   app.post("/api/admin/upload-image", createImageUpload({
     staticRoot: path.resolve(__dirname, "../public"),
   }));
   ```

   * Endpoint `POST /api/admin/upload-image` pour l'upload d'images via l'interface admin
   * Monte **avant** les middlewares Vite

3. **Création du serveur Express + Vite middleware**

   ```js
   const vite = await createViteServer({
     server: { middlewareMode: true },
     appType: "custom",
     ssr: { noExternal: ["@radix-ui/*", "lucide-react", "@communecter/cocolight-api-client"] },
   });
   app.use(vite.middlewares);
   ```

   * `middlewareMode: true` active HMR et compilation à la volée.
   * `noExternal` force Vite à bundler ces dépendances pour SSR .

### Config: chargement et cache

   La config est chargee **une seule fois** au demarrage via `loadSiteConfig()` et stockee dans `cachedConfig`. Elle n'est **pas** relue a chaque requete.

   ```js
   /* ---- Charger la config UNE SEULE FOIS au démarrage ---------------- */
   let cachedConfig = await loadSiteConfig();
   if (!cachedConfig) {
     console.log("Pas de config externe, chargement de demo-site.ts...");
     const { demoSiteConfig } = await vite.ssrLoadModule("/src/data/demo-site.ts");
     cachedConfig = demoSiteConfig;
   }
   ```

### Config: hot-reload et sauvegarde WebSocket

   Le serveur surveille le fichier config avec `fs.watchFile` et envoie les mises a jour aux clients via le WebSocket Vite :

   ```js
   fs.watchFile(configPath, { interval: 500 }, () => {
     try {
       const raw = fs.readFileSync(configPath, "utf-8");
       const newConfig = JSON.parse(raw);
       cachedConfig = newConfig;
       console.log("[HMR] Config reloaded, sending to clients...");
       vite.ws.send({ type: "custom", event: "config-update", data: newConfig });
     } catch (e) {
       console.error("[HMR] Config reload error:", e.message);
     }
   });
   ```

   Le serveur ecoute egalement un evenement WebSocket `config-save` pour permettre la sauvegarde de la config depuis l'interface admin :

   ```js
   vite.ws.on("config-save", (data) => {
     if (!process.env.SITE_CONFIG_PATH) {
       console.error("[Admin] SITE_CONFIG_PATH non défini, impossible de sauvegarder");
       return;
     }
     // ...
     const json = JSON.stringify(data, null, 2) + "\n";
     fs.writeFileSync(configPath, json, "utf-8");
     cachedConfig = data;
     console.log("[Admin] Config saved to", configPath);
   });
   ```

3. **Filtrage des requêtes statiques non gérées**
   Toutes les URL correspondant à assets (images, CSS, JS, etc.) renvoient un 404 pour éviter le SSR inutile .

4. **Route catch‑all SSR**

   ```js
   app.use(["/{*all}"], async (req, res) => {
     const template = fs.readFileSync(path.resolve(__dirname, "../index.html"), "utf-8");
     const html = await vite.transformIndexHtml(url, template);
     const config = cachedConfig;
     const cfgScript = `<script>window.__CONFIG__=${serialize(config, { isJSON:true })}</script>`;
     // découpe template sur <!--app-head--> et <!--app-html-->
     const [headStart, rest] = template.split("<!--app-head-->");
     const [beforeBody, tail] = rest.split("<!--app-html-->");
     res.write(headStart);
     res.write(cfgScript);
     const { render } = await vite.ssrLoadModule("/src/entry-server.tsx");
     await render(req, res, config, (helmetHead, state) => {
       res.write(helmetHead);
       res.write(`<script>window.__REACT_QUERY_STATE__=${serialize(state, { isJSON: true })}</script>`);
       res.write(beforeBody);
     }, tail);  // 5ème argument : closing tags (</head>...<body>...</body></html>)
   });
   ```

   * Injection **unique** de `window.__CONFIG__` avant tout head .
   * Appel de `render(req, res, config, onHead, tail)` avec 5 arguments : le 5eme (`tail`) contient les closing tags HTML issus du template.

5. **Démarrage du serveur**

   ```js
   app.listen(process.env.PORT || 5173);
   ```

---

## `server/prod-server.js`

1. **Middleware d'optimisation d'images**

   ```js
   import { createImageOptimizer } from "./middleware/imageOptimizer.js";
   app.use("/img", createImageOptimizer({
     staticRoot: path.resolve(__dirname, "../dist/client"),
     cacheDir: path.resolve(__dirname, "../.cache/images"),
   }));
   ```

   * Monte **avant** `compression` et `serveStatic`
   * `staticRoot` pointe vers `dist/client/` en prod

2. **Compression et static serving**

   ```js
   app.use(compression());
   app.use(serveStatic(path.resolve(__dirname, "../dist/client"), { index: false }));
   ```
2. **Chargement de la configuration en production**
   Fonction `loadSiteConfig()` lit soit `SITE_CONFIG_JSON`, soit `SITE_CONFIG_PATH`, et lance une erreur si aucun n'est défini .
3. **Filtrage des assets**
   Même pattern que le dev‑server pour éviter SSR sur les fichiers statiques.
4. **Route SSR universelle**

   ```js
   app.use(['/{*all}'], async (req, res) => {
     const template = fs.readFileSync("../dist/client/index.html", "utf-8");
     const siteConfig = await loadSiteConfig();
     const configScript = `<script>window.__CONFIG__=${serialize(siteConfig)}</script>`;
     const envScript = /* injection window.__ENV__ si défini */;
     res.write(headStart);
     res.write(configScript);
     res.write(envScript);
     const { render } = await import("../dist/server/entry-server.js");
     await render(req, res, siteConfig, (helmetHead, state) => {
       res.write(helmetHead);
       res.write(`<script>window.__REACT_QUERY_STATE__=${serialize(state)}</script>`);
       res.write(beforeRoot);
     });
   });
   ```

   * Injection de `window.__ENV__` si défini (`VITE_BASE_URL_BACKEND`, `VITE_SERVER_URL`, `VITE_SLUG`) .
5. **Démarrage**

   ```js
   app.listen(process.env.PORT || 3000);
   ```

---

## `src/entry-server.tsx`

1. **Import des outils SSR**

   * `renderToPipeableStream` de React 19
   * `HelmetProvider` pour `<title>` et `<meta>` dynamiques
   * `createStaticHandler/Router` de React Router pour loaders et actions
   * `Transform` de `node:stream` pour le pattern de streaming avec closing tags

2. **Signature de la fonction `render`**

   ```ts
   export async function render(
     req: Request,
     res: Response,
     cfg: SiteConfig,
     onHead: (headHtml: string, dehydratedState: DehydratedState) => Promise<void>,
     closingTags = '</div></body></html>',
   ): Promise<void>
   ```

   La callback `onHead` est **async** et recoit `headHtml` (balises meta/title/preload) et `dehydratedState`.
   Le 5eme argument `closingTags` contient le HTML de fermeture (closing tags du template).

3. **Préparation du router**

   ```ts
   const handler  = createStaticHandler(await buildRoutes(cfg, queryClient));
   const context  = await handler.query(new Request(absUrl));
   if (context instanceof Response) { /* redirection ou erreur */ }
   const router = createStaticRouter(handler.dataRoutes, context);
   ```

4. **Initialisation de React Query**

   ```ts
   const queryClient = new QueryClient({ defaultOptions:{ queries: { staleTime:60000 } } });
   await queryClient.ensureQueryData({ queryKey:["cocolight-init"], queryFn:()=>initApi(...) });
   const dehydratedState = dehydrate(queryClient, { shouldDehydrateQuery: q=>q.queryKey[0]!=="cocolight-init" });
   ```

### Intégration vite-preload

   Le module `vite-preload` est utilise pour tracer les composants lazy-loaded et injecter les balises `<link rel="modulepreload">` dans le HTML SSR :

   ```ts
   import {
     ChunkCollectorContext,
     createChunkCollector,
     preloadAll
   } from 'vite-preload';

   // Précharger tous les composants lazy AVANT le rendu
   await preloadAll();

   // Créer le collecteur de chunks pour injecter les modulepreload
   const collector = createChunkCollector({
     manifest: './dist/client/.vite/manifest.json',
     entry: 'index.html',
   });
   ```

   Le `ChunkCollectorContext` enveloppe l'arbre React pour tracer les chunks utilises :

   ```tsx
   <HelmetProvider context={helmetCtx}>
     <ChunkCollectorContext collector={collector}>
       <QueryClientProvider client={queryClient}>
         <HydrationBoundary state={dehydratedState}>
           <StaticRouterProvider router={router} context={context} />
         </HydrationBoundary>
       </QueryClientProvider>
     </ChunkCollectorContext>
   </HelmetProvider>
   ```

### Extraction des ressources critiques

   Avant d'envoyer le `<head>`, le serveur extrait les ressources critiques pour le LCP (Largest Contentful Paint) :

   ```ts
   import { extractCriticalImages, extractCriticalFonts } from './lib/extractCriticalResources';
   import { generateImagePreloadTags, generateFontPreloadTags } from './lib/generatePreloadTags';

   // Dans onShellReady :
   const criticalImages = extractCriticalImages(cfg, pathname, loaderData);
   const imagePreloadTags = generateImagePreloadTags(criticalImages);

   const criticalFonts = extractCriticalFonts(cfg);
   const fontPreloadTags = generateFontPreloadTags(criticalFonts);

   const preloadTags = collector.getTags();

   onHead(
     `${fontPreloadTags}
      ${imagePreloadTags}
      ${preloadTags}
      ${helmetCtx.helmet?.title ?? ''}
      ${helmetCtx.helmet?.meta ?? ''}
      ${helmetCtx.helmet?.link ?? ''}`,
      dehydratedState
   );
   ```

   * `extractCriticalImages()` : extrait les images critiques depuis la config et les donnees des loaders pour la page courante
   * `extractCriticalFonts()` : extrait les fonts critiques (Google Fonts) depuis la config du site
   * `generateImagePreloadTags()` / `generateFontPreloadTags()` : genere les balises `<link rel="preload">` correspondantes
   * Les fonts et images sont injectees **en premier** dans le head pour une priorite maximale

### Pattern Transform stream

   Au lieu d'ecrire directement les closing tags dans `onAllReady`, le serveur utilise un `Transform` stream qui les ajoute automatiquement via `flush()` :

   ```ts
   const appendTransform = new Transform({
     transform(chunk, _encoding, callback) {
       callback(null, chunk);
     },
     flush(callback) {
       this.push(closingTags);
       callback();
     },
   });

   appendTransform.pipe(res as unknown as Writable);
   ```

   Dans les callbacks de `renderToPipeableStream` :

   ```ts
   onShellReady() {
     onHead(headHtml, dehydratedState);
     pipe(appendTransform);  // Pipe vers le transform, pas directement vers res
   },
   onAllReady() {
     // Terminer le transform stream, ce qui déclenche flush()
     // et ajoute les closing tags automatiquement
     appendTransform.end();
   },
   ```

   Ce pattern garantit que les closing tags sont toujours emis, meme en cas d'erreur partielle dans le streaming.

   * `bootstrapModules` indique au client quel module charger pour hydrater.
   * `onHead` callback injecte fonts, images, preload tags, `<title>`, `<meta>` et le script React Query.
   * Un timeout de 30 secondes (`STREAM_TIMEOUT_MS`) appelle `abort()` pour ne pas bloquer indefiniment.

---

## `src/entry-client.tsx` - Hydratation avec detection Sync/Async

Le fichier `entry-client.tsx` gère l'hydratation côté client avec une **détection automatique** du mode synchrone ou asynchrone de `buildRoutes()`, ce qui permet d'éviter le flash de loading pour les modules core.

### Import CSS virtuel

```ts
import "virtual:site-css";
```

Cet import charge le CSS du site via le plugin Vite `siteCssPlugin()`. Le fichier CSS est résolu dynamiquement selon l'ordre de priorité : `SITE_CSS_CONTENT` > `SITE_CSS_PATH` > `VITE_SLUG` (lookup `sites.json`) > `src/index.css` (défaut).

### Gestion du loader et des stylesheets

Trois fonctions gèrent la transition entre le loader HTML initial et l'application React hydratée :

```ts
function areStylesheetsLoaded(): boolean {
  const stylesheets = document.querySelectorAll('link[rel="stylesheet"]');
  for (const sheet of stylesheets) {
    const linkEl = sheet as HTMLLinkElement;
    if (linkEl.sheet === null) {
      return false;
    }
  }
  return true;
}

function hideLoader() {
  const loader = document.getElementById('app-loader');
  const root = document.getElementById('root');

  document.documentElement.classList.remove('loading-active');

  if (loader) {
    loader.classList.add('hidden');
    setTimeout(() => {
      loader.remove();
      const criticalStyles = document.getElementById('critical-loader');
      if (criticalStyles) criticalStyles.remove();
    }, 300);
  }

  if (root) {
    root.classList.add('loaded');
  }
}

function waitForStylesAndHideLoader() {
  if (areStylesheetsLoaded()) {
    requestAnimationFrame(() => {
      hideLoader();
    });
  } else {
    setTimeout(waitForStylesAndHideLoader, 50);
  }
}
```

- `areStylesheetsLoaded()` : vérifie que toutes les `<link rel="stylesheet">` sont chargées (propriété `sheet` non null)
- `hideLoader()` : masque le loader HTML (`#app-loader`), retire la classe `loading-active` du `<html>`, ajoute la classe `loaded` au `#root`, et nettoie les styles critiques inline après 300ms
- `waitForStylesAndHideLoader()` : poll toutes les 50ms jusqu'à ce que les styles soient chargés, puis appelle `hideLoader()` dans un `requestAnimationFrame`

### HMR config reload

En mode développement, le client écoute l'événement WebSocket `config-update` envoyé par le dev-server lorsque le fichier config change sur disque :

```ts
if (import.meta.hot) {
  import.meta.hot.on('config-update', (newConfig: SiteConfig) => {
    console.log('load...');
    window.__CONFIG__ = newConfig;
    window.dispatchEvent(new CustomEvent('site-config-update', { detail: newConfig }));
  });
}
```

Cela permet le hot-reload de la configuration JSON sans recharger la page.

### Déclarations globales TypeScript

```ts
declare global {
  interface Window {
    __CONFIG__: SiteConfig;                    // Config JSON injectée par le serveur
    __REACT_QUERY_STATE__: DehydratedState | undefined; // État React Query désérialisé
    __staticRouterHydrationData?: Partial<     // Données d'hydratation React Router
      Pick<RouterState, "errors" | "loaderData" | "actionData">
    >;
  }
}
```

Ces déclarations permettent à TypeScript de typer correctement les variables globales injectées par le serveur SSR.

### Récupération de la config et du state

```ts
const siteConfig = window.__CONFIG__;
const dehydratedState = window.__REACT_QUERY_STATE__ ?? null;
```

- `siteConfig`: Configuration JSON complète du site
- `dehydratedState`: État React Query sérialisé par le serveur (pour éviter les re-fetch)

### BuildRoutes avec détection Sync/Async

```ts
// buildRoutes retourne RouteObject[] (sync) ou Promise<RouteObject[]> (async)
// Sync : côté client avec modules core uniquement → pas de flash loading
// Async : côté serveur ou modules optional → loading temporaire
const routesOrPromise = buildRoutes(siteConfig);
```

**Comportement de `buildRoutes()` côté client**:
- **Mode SYNCHRONE** (modules core uniquement): Retourne directement `RouteObject[]`
- **Mode ASYNCHRONE** (avec modules optional): Retourne `Promise<RouteObject[]>`

**Pourquoi cette distinction ?**
- **Modules core** (type: "core"): Chargés en eager (synchrone), pas de code-splitting → pas de flash
- **Modules optional** (type: "optional"): Chargés en lazy (asynchrone), avec code-splitting → flash temporaire

### Composant Root avec gestion Sync/Async

```tsx
function Root() {
  // 1. Créer le QueryClient (une seule fois)
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,  // Évite le refetch immédiat après hydratation
      },
    },
  }));

  // 2. Initialiser le router (sync ou null si async)
  const [router, setRouter] = useState<ReturnType<typeof createBrowserRouter> | null>(() => {
    if (routesOrPromise instanceof Promise) {
      // Async : modules optional → initialiser à null
      return null;
    } else {
      // Sync : modules core → créer le router immédiatement (pas de flash!)
      return createBrowserRouter(routesOrPromise, {
        hydrationData: window.__staticRouterHydrationData
      });
    }
  });

  // 3. Charger le router de manière asynchrone si nécessaire
  useEffect(() => {
    if (routesOrPromise instanceof Promise) {
      routesOrPromise
        .then((routes) => createBrowserRouter(routes, {
          hydrationData: window.__staticRouterHydrationData
        }))
        .then(setRouter);
    }
  }, []);

  // 4. Quand le router est prêt, attendre les styles puis masquer le loader
  useEffect(() => {
    if (router) {
      waitForStylesAndHideLoader();
    }
  }, [router]);

  // 5. Si router pas encore chargé, garder le HTML SSR intact
  if (!router) {
    return null;  // Pas de flash, le HTML SSR reste affiché
  }

  // 6. Hydratation normale
  return (
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <HydrationBoundary state={dehydratedState}>
          <RouterProvider router={router} />
        </HydrationBoundary>
      </QueryClientProvider>
    </HelmetProvider>
  );
}
```

**Flux d'exécution détaillé**:

1. **QueryClient**: Créé une seule fois avec `useState(() => ...)` (lazy initialization)
2. **Router initialization**:
   - **Si sync** (`RouteObject[]`): Créer le router immédiatement dans `useState`
   - **Si async** (`Promise<RouteObject[]>`): Initialiser `router` à `null`
3. **useEffect**: Si async, charger les routes puis créer le router
4. **useEffect**: Quand le router est prêt, appeler `waitForStylesAndHideLoader()` pour masquer le loader HTML et afficher l'application
5. **Rendu conditionnel**:
   - Si `router === null`: Retourne `null` → le HTML SSR reste affiché (pas de flash)
   - Si `router !== null`: Hydrate normalement avec `RouterProvider`

### Avantage de ce pattern

**Modules core uniquement (mode sync)**:
```
buildRoutes → RouteObject[] → createBrowserRouter → Hydratation immédiate
                                                       ↓
                                               Pas de flash!
```

**Avec modules optional (mode async)**:
```
buildRoutes → Promise<RouteObject[]> → router=null → HTML SSR affiché
                                              ↓
                                        useEffect résout
                                              ↓
                                   createBrowserRouter → setRouter → Hydratation
                                                                        ↓
                                                              Flash temporaire
```

**Limitation**: Si modules optional sont présents, l'utilisateur verra temporairement le HTML SSR sans interactivité jusqu'à ce que le code-splitting soit terminé.

**Avantage**: Pour les modules core (profil, search), aucun flash de loading → expérience instantanée.

### Hydratation React Query

```tsx
<HydrationBoundary state={dehydratedState}>
  <RouterProvider router={router} />
</HydrationBoundary>
```

Le `HydrationBoundary` reprend l'état React Query sérialisé par le serveur:
- **Évite les re-fetch** inutiles après hydratation
- **Garantit la cohérence** entre SSR et client
- **Améliore les performances** (pas d'attente réseau)

### Hydratation Helmet (meta tags)

```tsx
<HelmetProvider>
  {/* ... */}
</HelmetProvider>
```

Le `HelmetProvider` synchronise les meta tags entre serveur et client:
- Côté serveur: `react-helmet` génère les tags dans `<head>`
- Côté client: `react-helmet` prend le contrôle des tags existants
- Permet les mises à jour dynamiques des meta tags lors de la navigation

### Point d'entrée final

```tsx
const container = document.getElementById("root");

if (container) {
  hydrateRoot(container, <Root />);
} else {
  console.error("❌ #root non trouvé pour l'hydratation");
}
```

- `hydrateRoot`: Fonction React 18+ pour hydrater un rendu SSR
- Réutilise le HTML généré par le serveur au lieu de le remplacer
- Attache les event listeners pour rendre l'UI interactive

### Initialisation i18n

```ts
import "@/i18n"; // init react-i18next via I18nBridge
```

L'import de `@/i18n` initialise react-i18next côté client:
- Charge les traductions depuis les bundles
- Configure le détecteur de langue
- Synchronise avec les traductions SSR

---

## Pattern SSR Loader - Pre-fetching des données

Les **loaders** de React Router permettent de pré-charger les données côté serveur avant le rendu. SiteForge utilise ce pattern dans tous les modules qui nécessitent des données API (profil, search, etc.).

### Principe du SSR Loader

Le loader est une fonction asynchrone qui:
1. S'exécute **avant le rendu** de la route (côté serveur uniquement en SSR)
2. Pré-charge les données dans **React Query**
3. Désérialise l'état React Query dans le HTML
4. Évite les **double-fetch** côté client (hydratation sans refetch)

**Avantages**:
- **SEO**: Les données sont dans le HTML initial (indexables par les moteurs de recherche)
- **Performance**: Pas d'attente réseau côté client
- **UX**: Pas de spinner de chargement lors de la navigation initiale

### Anatomie d'un loader

Un loader typique suit ce pattern:

```ts
// Dans routes.tsx d'un module
export const routes: ModuleRouteFactory = (queryClient?: QueryClient): RouteObject[] => [
  {
    path: ":slug",
    element: <ProfilePage />,
    loader: async ({ params }: LoaderFunctionArgs) => {
      // 1. Si pas de queryClient (côté client), skip le pre-fetch
      if (!queryClient) return null;

      // 2. Extraire et valider les paramètres
      const slug = params.slug?.startsWith('@')
        ? params.slug.slice(1)
        : params.slug;

      if (!slug) {
        throw new Response('Not Found', { status: 404 });
      }

      try {
        // 3. Pré-charger les données dans React Query
        return await queryClient.ensureQueryData({
          queryKey: ["element-about", slug],
          queryFn: async () => {
            const { organization } = await initApi({
              baseURL: getBaseUrl(),
              debug: true
            });
            return organization.entityBySlug(slug);
          }
        });
      } catch (error) {
        console.error('Erreur lors du chargement du profil:', error);
        throw new Response('Not Found', { status: 404 });
      }
    }
  }
];
```

### Détection côté serveur vs client

```ts
if (!queryClient) return null;
```

**Pourquoi cette vérification ?**
- **Côté serveur** (SSR): `buildRoutes(config, queryClient)` passe un `queryClient` → le loader s'exécute
- **Côté client** (navigation): `buildRoutes(config)` ne passe **pas** de `queryClient` → le loader est skippé

**Avantage**: Évite les double-fetch. Côté client, le composant utilise `useQuery` qui récupère les données depuis le cache React Query.

### Utilisation de ensureQueryData

```ts
await queryClient.ensureQueryData({
  queryKey: ["element-about", slug],
  queryFn: async () => {
    // Appel API
    return organization.entityBySlug(slug);
  }
});
```

**`ensureQueryData` vs `fetchQuery`**:
- `fetchQuery`: **Toujours** fetch, même si les données sont en cache
- `ensureQueryData`: Fetch **uniquement si** les données ne sont pas en cache

**Avantage**: Si plusieurs loaders utilisent la même `queryKey`, un seul fetch est effectué.

### Gestion des erreurs dans les loaders

Les loaders peuvent throw des `Response` pour gérer les erreurs:

```ts
// 404 Not Found
throw new Response('Not Found', { status: 404 });

// 500 Server Error
throw new Response('Internal Server Error', { status: 500 });

// Redirect
throw redirect('/login');
```

React Router capture ces erreurs et les affiche via `errorElement` ou `ErrorBoundary`.

### Désérialisation de l'état React Query

Côté serveur (`entry-server.tsx`):

```ts
// 1. Déshydrater l'état après le rendu
const dehydratedState = dehydrate(queryClient, {
  shouldDehydrateQuery: (q) => q.queryKey[0] !== "cocolight-init"
});

// 2. Injecter dans le HTML
res.write(`<script>window.__REACT_QUERY_STATE__=${serialize(dehydratedState)}</script>`);
```

Côté client (`entry-client.tsx`):

```ts
// 3. Récupérer l'état
const dehydratedState = window.__REACT_QUERY_STATE__ ?? null;

// 4. Hydrater React Query
<HydrationBoundary state={dehydratedState}>
  <RouterProvider router={router} />
</HydrationBoundary>
```

**Flux complet**:
1. Serveur: Loader pré-charge → React Query cache
2. Serveur: Déshydratation → `window.__REACT_QUERY_STATE__`
3. Client: Récupération → Hydratation React Query
4. Client: `useQuery` trouve les données dans le cache → pas de refetch

### Pattern avec initApi singleton

Les loaders utilisent souvent `initApi()` pour initialiser l'API:

```ts
queryFn: async () => {
  const { organization } = await initApi({
    baseURL: getBaseUrl(),
    debug: true
  });
  return organization.entityBySlug(slug);
}
```

**Pourquoi ce pattern ?**
- `initApi()` utilise le **singleton** d'API client (voir Section 8.1)
- Garantit qu'une seule instance API existe par requête SSR
- Partage la connexion, les tokens, et le cache entre loaders

### Exemple complet: Module Profil

```ts
// src/modules/profil/routes.tsx
export const routes: ModuleRouteFactory = (queryClient?: QueryClient): RouteObject[] => [
  {
    path: ":slug",
    element: <ProfilePage />,
    loader: async ({ params }: LoaderFunctionArgs) => {
      if (!queryClient) return null;

      const rawSlug = params.slug;
      const slug = rawSlug?.startsWith('@') ? rawSlug.slice(1) : rawSlug;

      if (!slug) {
        throw new Response('Not Found', { status: 404 });
      }

      try {
        return await queryClient.ensureQueryData({
          queryKey: ["element-about", slug],
          queryFn: async () => {
            const { organization } = await initApi({
              baseURL: getBaseUrl(),
              debug: true
            });
            if (!organization) {
              throw new Error("API non initialisée");
            }
            return organization.entityBySlug(slug);
          }
        });
      } catch (error) {
        console.error('Erreur lors du chargement du profil:', error);
        throw new Response('Not Found', { status: 404 });
      }
    }
  }
];
```

**Usage dans le composant**:

```tsx
// src/modules/profil/pages/ProfilePage.tsx
export default function ProfilePage() {
  const { slug } = useParams();
  const cleanSlug = slug?.startsWith('@') ? slug.slice(1) : slug;

  // Les données sont déjà en cache (pré-chargées par le loader)
  const { data: entity, isLoading, isError } = useEntityBySlugQuery({ slug: cleanSlug });

  if (isLoading) return <ProfileSkeleton />;
  if (isError) return <ErrorCard />;
  if (!entity) return <NotFoundCard />;

  return <ProfileContent entity={entity} />;
}
```

**Flux d'exécution**:
1. **SSR**: Loader pré-charge `entityBySlug(slug)` → React Query cache
2. **SSR**: Déshydratation → HTML avec `window.__REACT_QUERY_STATE__`
3. **Client**: Hydratation → React Query reprend le cache
4. **Client**: `useEntityBySlugQuery` trouve les données dans le cache → `isLoading=false` immédiatement
5. **Client**: Rendu immédiat du profil (pas de spinner)

### Optimisations avancées

**1. Prefetch multiple dans un loader**:

```ts
loader: async ({ params }) => {
  if (!queryClient) return null;

  // Prefetch en parallèle
  await Promise.all([
    queryClient.ensureQueryData({
      queryKey: ["profile", params.slug],
      queryFn: () => fetchProfile(params.slug)
    }),
    queryClient.ensureQueryData({
      queryKey: ["profile-events", params.slug],
      queryFn: () => fetchProfileEvents(params.slug)
    }),
  ]);

  return null;
};
```

**2. Filtrage du cache à déshydrater**:

```ts
// Ne pas déshydrater les queries de type "cocolight-init"
const dehydratedState = dehydrate(queryClient, {
  shouldDehydrateQuery: (query) => query.queryKey[0] !== "cocolight-init"
});
```

**Raison**: Certaines queries sont spécifiques au serveur et ne doivent pas être envoyées au client (tokens sensibles, config serveur, etc.).

### Limitations et considérations

**Limitations**:
- Les loaders s'exécutent **uniquement** lors de la navigation initiale SSR
- Lors de la navigation client-side (SPA), les loaders ne s'exécutent pas avec `queryClient`
- Les données doivent être **sérialisables** (pas de fonctions, de classes avec méthodes, etc.)

**Bonnes pratiques**:
- Toujours vérifier `if (!queryClient) return null;`
- Utiliser `ensureQueryData` plutôt que `fetchQuery` pour éviter les double-fetch
- Utiliser la même `queryKey` dans le loader et dans `useQuery`
- Gérer les erreurs avec `throw new Response(...)`

---

Avec ces quatre fichiers, SiteForge propose :

* Un **dev-server** ultra-rapide (HMR + SSR on‑the‑fly).
* Un **prod-server** optimisé (gzip, caching long, injection config/env, streaming SSR).
* Un **entry-server** robuste (React Router loaders, React Query prefetch, streaming avec Helmet).
* Un **entry-client** fluide (hydrateRoot, React Query, React Router hydratation).

---

## Voir aussi

- [Architecture](03-architecture.md)
- [API & Auth](11-api-authentification.md)
- [Performance](12-performance.md)
