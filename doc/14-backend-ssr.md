[← Retour à l'index](README.md)

# Backend et SSR

**Sommaire**

- [Backend et SSR](#backend-et-ssr)
  - [`server/dev-server.js`](#serverdev-serverjs)
    - [Middleware d'upload d'images](#middleware-dupload-dimages)
    - [Config: chargement et cache](#config-chargement-et-cache)
    - [Config: hot-reload et sauvegarde WebSocket](#config-hot-reload-et-sauvegarde-websocket)
    - [Warmup SSR bloquant](#warmup-ssr-bloquant)
  - [`server/prod-server.js`](#serverprod-serverjs)
  - [`src/entry-server.tsx`](#srcentry-servertsx)
    - [Initialisation de React Query et `cocolight-data`](#initialisation-de-react-query-et-cocolight-data)
    - [Intégration vite-preload](#intégration-vite-preload)
    - [Extraction des ressources critiques](#extraction-des-ressources-critiques)
    - [Pattern `pipe(res)` + override `res.end()` (React 19 + Vite)](#pattern-piperes--override-resend-react-19--vite)
    - [Gestion des erreurs de stream et timeout](#gestion-des-erreurs-de-stream-et-timeout)
    - [Pré-normalisation HTML/SVG : `server/utils/normalizeSiteConfig.js`](#pré-normalisation-htmlsvg--serverutilsnormalizesiteconfigjs)
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

> ℹ **Warning "Hydration failed" au 1er hit en dev** — c'est un comportement
> documenté de l'écosystème Vite + `React.lazy()` + SSR en mode dev. Le bug
> n'apparaît **qu'en dev au premier chargement** (cache navigateur vide) et
> disparaît au refresh. En prod, `vite-preload` injecte les `<link rel="modulepreload">`
> et tout fonctionne sans mismatch. Détail complet :
> `commentaire/HYDRATION-DEV-FIRST-LOAD.md`.

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
     server: {
       middlewareMode: true,
       allowedHosts: true,
     },
     appType: "custom",
     ssr: { noExternal: ["@radix-ui/*", "lucide-react", "@communecter/cocolight-api-client"] },
   });

   // Routes API (helloasso, admin upload…) enregistrées AVANT vite.middlewares
   app.use(express.json());
   app.get("/api/helloasso/token", helloassoTokenHandler);
   app.post("/api/helloasso/checkout-intent", helloassoCheckoutIntentHandler);
   // … autres routes HelloAsso

   app.use(vite.middlewares); // ⚠ Vite DOIT être après les routes API
   ```

   * `middlewareMode: true` active HMR et compilation à la volée.
   * `allowedHosts: true` permet les requêtes depuis n'importe quel hôte (utile en réseau local / conteneur).
   * `noExternal` force Vite à bundler ces dépendances pour SSR.
   * `express.json()` est monté avant Vite pour parser les corps des requêtes API.

### Config: chargement et cache

   La config est chargée **une seule fois** au démarrage via `loadSingleConfig()` et stockée dans `cachedConfig`. Elle est immédiatement pré-normalisée via `normalizeSiteConfig()` avant d'être servie à React SSR et injectée dans `window.__CONFIG__`. La config n'est **pas** relue à chaque requête.

   ```js
   import { normalizeSiteConfig } from "./utils/normalizeSiteConfig.js";

   let cachedConfig = await loadSingleConfig();
   if (!cachedConfig) {
     console.log("Pas de config externe, chargement de demo-site.ts...");
     const { demoSiteConfig } = await vite.ssrLoadModule("/src/data/demo-site.ts");
     cachedConfig = demoSiteConfig;
   }
   // Pré-sanitize les champs HTML/SVG pour SSR/client identiques
   cachedConfig = normalizeSiteConfig(cachedConfig);
   ```

### Config: hot-reload et sauvegarde WebSocket

   Le serveur surveille le fichier config avec `fs.watchFile` et envoie les mises à jour aux clients via le WebSocket Vite. Le hot-reload re-normalise également la config rechargée :

   ```js
   fs.watchFile(configPath, { interval: 500 }, () => {
     try {
       cachedConfig = normalizeSiteConfig(JSON.parse(fs.readFileSync(configPath, "utf-8")));
       console.log("[HMR] Config reloaded, sending to clients...");
       vite.ws.send({ type: "custom", event: "config-update", data: cachedConfig });
     } catch (e) {
       console.error("[HMR] Config reload error:", e.message);
     }
   });
   ```

   Le serveur écoute également un événement WebSocket `config-save` pour permettre la sauvegarde de la config depuis l'interface admin. La config sauvegardée est aussi re-normalisée immédiatement :

   ```js
   vite.ws.on("config-save", (data) => {
     if (!process.env.SITE_CONFIG_PATH) {
       console.error("[Admin] SITE_CONFIG_PATH non défini, impossible de sauvegarder");
       return;
     }
     const json = JSON.stringify(data, null, 2) + "\n";
     fs.writeFileSync(configPath, json, "utf-8");
     cachedConfig = normalizeSiteConfig(data);
     console.log("[Admin] Config saved to", configPath);
   });
   ```

4. **Route SSR catch-all**

   La fonction `renderSite()` gère le rendu :

   ```js
   async function renderSite(req, res, config, slug) {
     const url = req.originalUrl;
     let template = fs.readFileSync(path.resolve(__dirname, "../index.html"), "utf-8");
     template = await vite.transformIndexHtml(url, template);

     const cfgScript = `<script>window.__CONFIG__=${serialize(config, { isJSON: true })}</script>`;
     const envScript = envSlug
       ? `<script>window.__ENV__={VITE_SLUG:${JSON.stringify(envSlug)},VITE_BASE_URL_BACKEND:${JSON.stringify(process.env.VITE_BASE_URL_BACKEND || "")},VITE_SERVER_URL:${JSON.stringify(process.env.VITE_SERVER_URL || "")}}</script>`
       : "";

     const [headStart, rest] = template.split("<!--app-head-->");
     const [beforeBody, tail] = rest.split("<!--app-html-->");

     res.status(200).setHeader("Content-Type", "text/html; charset=utf-8");
     res.write(headStart);
     res.write(cfgScript);
     res.write(envScript);

     const { render } = await vite.ssrLoadModule("/src/entry-server.tsx");
     await render(req, res, config, (helmetHead, dehydratedState) => {
       res.write(helmetHead);
       res.write(`<script>window.__REACT_QUERY_STATE__=${serialize(dehydratedState, { isJSON: true })}</script>`);
       res.write(beforeBody);
     }, tail);  // 5e argument : closing tags issus du template

     // Sécurité : s'assurer que la réponse est bien fermée après le streaming
     if (!res.writableEnded) {
       res.end();
     }
   }

   app.use(["/{*all}"], async (req, res) => {
     await renderSite(req, res, cachedConfig, singleSlug);
   });
   ```

   * Injection de `window.__CONFIG__` avant le head SSR.
   * Injection de `window.__ENV__` si `VITE_SLUG` est défini (ou `VITE_BASE_URL_BACKEND`/`VITE_SERVER_URL`).
   * Appel de `render(req, res, config, onHead, tail)` avec 5 arguments : le 5e (`tail`) contient les closing tags HTML issus du template.
   * `if (!res.writableEnded) res.end()` garantit que le navigateur ne reste pas en `readyState "loading"` en cas de stream déjà terminé (cf. fix 30ed931).

### Warmup SSR bloquant

   Avant d'accepter les connexions, le dev-server pré-compile `entry-server.tsx` et toute sa chaîne d'imports de manière **bloquante** (avant le `app.listen()`) :

   ```js
   console.log("[warmup] Pré-compilation SSR en cours...");
   try {
     await vite.ssrLoadModule("/src/entry-server.tsx");
     console.log(`[warmup] SSR prêt en ${elapsed}ms`);
   } catch (e) {
     console.error("[warmup] Échec :", e.message);
   }

   app.listen(process.env.PORT || 5173);
   ```

   Sans ce warmup, le premier hit au cold start déclenche la compilation pendant le rendu SSR, ce qui peut produire un `<div id="root">` vide (modules pas tous résolus quand React rend) et un "Hydration failed" côté client. `server.warmup` dans `vite.config.ts` est asynchrone et non-bloquant, donc insuffisant pour ce cas.

5. **Démarrage du serveur**

   ```js
   app.listen(process.env.PORT || 5173);
   ```

---

## `server/prod-server.js`

1. **Chargement de la config au démarrage (synchrone, une seule fois)**

   En production, la config est chargée et normalisée **au niveau module**, avant tout traitement de requête :

   ```js
   import { normalizeSiteConfig } from "./utils/normalizeSiteConfig.js";

   // loadSiteConfig() est synchrone (fs.readFileSync) et lance une erreur si
   // ni SITE_CONFIG_JSON ni SITE_CONFIG_PATH ne sont définis.
   const cachedConfig = normalizeSiteConfig(loadSiteConfig());
   const configScript = `<script>window.__CONFIG__=${serialize(cachedConfig, { isJSON: true })}</script>`;
   ```

   `loadSiteConfig()` lit soit `SITE_CONFIG_JSON` (JSON inline), soit `SITE_CONFIG_PATH` (chemin de fichier), et lance une erreur fatale si aucun n'est défini — pas de fallback `demo-site.ts` en production.

2. **Middleware d'optimisation d'images**

   ```js
   app.use("/img", createImageOptimizer({
     staticRoot: path.resolve(__dirname, "../dist/client"),
     cacheDir: path.resolve(__dirname, "../.cache/images"),
   }));
   ```

   * Monte **avant** `compression` et `express.static`
   * `staticRoot` pointe vers `dist/client/` en prod

3. **Compression, caching et static serving**

   ```js
   app.use(compression({ level: 6, threshold: 1024 }));
   app.set('etag', 'strong');

   // Cache 1 an immutable pour assets hashés Vite
   app.use('/assets', (req, res, next) => {
     res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
     next();
   });

   // Cache 1 jour + revalidation 7 jours pour images statiques
   app.use('/images', (req, res, next) => {
     res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
     next();
   });

   app.use(express.static(path.resolve(__dirname, "../dist/client"), {
     index: false, etag: true, lastModified: true,
   }));
   ```

4. **Routes API HelloAsso**

   ```js
   app.use(express.json());
   app.get("/api/helloasso/token", helloassoTokenHandler);
   app.post("/api/helloasso/checkout-intent", helloassoCheckoutIntentHandler);
   app.get("/api/helloasso/callback", helloassoCallbackHandler);
   app.get("/api/helloasso/checkout-status/:checkoutIntentId", helloassoCheckoutStatusHandler);
   ```

5. **Route SSR universelle**

   ```js
   app.use(['/{*all}'], async (req, res) => {
     const template = fs.readFileSync("../dist/client/index.html", "utf-8");

     // window.__ENV__ injecté si au moins une variable runtime est définie
     let injectEnvScript = "";
     if (process.env.VITE_BASE_URL_BACKEND || process.env.VITE_SERVER_URL || process.env.VITE_SLUG) {
       injectEnvScript = `<script>window.__ENV__ = {
         VITE_BASE_URL_BACKEND: ${JSON.stringify(process.env.VITE_BASE_URL_BACKEND || "")},
         VITE_SERVER_URL: ${JSON.stringify(process.env.VITE_SERVER_URL || "")},
         VITE_SLUG: ${JSON.stringify(process.env.VITE_SLUG || "")}
       };</script>`;
     }

     const [headStart, rest]  = template.split("<!--app-head-->");
     const [beforeRoot, tail] = rest.split("<!--app-html-->");

     res.status(200).setHeader("Content-Type", "text/html; charset=utf-8");
     res.write(headStart);
     res.write(configScript);    // window.__CONFIG__ (pré-calculé au boot)
     res.write(injectEnvScript); // window.__ENV__ (conditionnel)

     const { render } = await import("../dist/server/entry-server.js");
     await render(req, res, cachedConfig, (helmetHead, dehydratedState) => {
       res.write(helmetHead);
       res.write(`<script>window.__REACT_QUERY_STATE__=${serialize(dehydratedState, { isJSON: true })}</script>`);
       res.write(beforeRoot);
     }, tail);  // 5e argument : closing tags du template

     if (!res.writableEnded) {
       res.end();
     }
   });
   ```

   * `window.__ENV__` est injecté uniquement si au moins une des variables runtime est définie.
   * `configScript` est une constante calculée au boot (pas recalculée par requête).
   * Le 5e argument `tail` est bien passé à `render()`, comme en dev.
   * `if (!res.writableEnded) res.end()` garantit la fermeture de la réponse (même fix que le dev-server).

6. **Démarrage**

   ```js
   app.listen(process.env.PORT || 3000);
   ```

---

## `src/entry-server.tsx`

1. **Imports principaux**

   * `renderToPipeableStream` de `react-dom/server`
   * `HelmetProvider`, `HelmetDataContext` de `@dr.pogodin/react-helmet`
   * `createStaticHandler`, `createStaticRouter`, `StaticRouterProvider` de `react-router`
   * `Writable` de `node:stream` (utilisé pour le cast `res as unknown as Writable` dans `pipe()` et pour l'écouteur `res.on('error', ...)`)
   * `dehydrate`, `HydrationBoundary`, `QueryClient`, `QueryClientProvider` de `@tanstack/react-query`
   * `ChunkCollectorContext`, `createChunkCollector`, `preloadAll` de `vite-preload`
   * `initApi`, `resetApiState` de `./lib/apiClient`
   * `extractCriticalImages`, `extractCriticalFonts` de `./lib/extractCriticalResources`
   * `generateImagePreloadTags`, `generateFontPreloadTags` de `./lib/generatePreloadTags`

   > **Note :** le module `Transform` de `node:stream` n'est **pas** importé — une approche avec Transform a été tentée et abandonnée (voir section Pattern `pipe(res)`).

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

   La callback `onHead` reçoit `headHtml` (balises fonts/images/preload/title/meta) et `dehydratedState`.
   Le 5e argument `closingTags` contient le HTML de fermeture issu du template (par défaut `</div></body></html>`).

3. **Reset de l'état API entre requêtes**

   ```ts
   resetApiState();
   ```

   Appelé en tout premier dans `render()`, ce reset vide le singleton API client entre les requêtes SSR pour éviter que les données d'un utilisateur ne contaminent la requête suivante.

4. **Préparation du routeur statique**

   ```ts
   const helmetCtx: HelmetDataContext = {};
   const queryClient = new QueryClient({
     defaultOptions: { queries: { staleTime: 60_000, refetchOnWindowFocus: false } }
   });
   const handler = createStaticHandler(await buildRoutes(cfg, queryClient));
   const absUrl  = `http://localhost${req.originalUrl ?? req.url ?? '/'}`;
   const context = await handler.query(new Request(absUrl));

   if (context instanceof Response) {
     res.status(context.status).set(Object.fromEntries(context.headers));
     res.end(await context.text());
     return;
   }

   const router = createStaticRouter(handler.dataRoutes, context);
   ```

   * `QueryClient` est créé **avant** `buildRoutes` car les loaders de routes y écrivent pendant `handler.query()`.
   * `refetchOnWindowFocus: false` est inclus dans les options (évite les refetch parasites).
   * Si `handler.query()` retourne une `Response` (redirection ou erreur loader), la réponse est transmise directement sans rendu React.

### Initialisation de React Query et `cocolight-data`

   ```ts
   // Pré-fetch initApi (non-sérialisable : classes ApiClient)
   const initResult = await queryClient.ensureQueryData({
     queryKey: ["cocolight-init"],
     queryFn: () => initApi({ baseURL: getBaseUrl() })
   });

   // Stocker les données SÉRIALISABLES séparément pour hydratation client
   queryClient.setQueryData(["cocolight-data"], {
     me:          initResult.me          ? initResult.me          : null,
     entity:      initResult.entity      ? initResult.entity      : null,
     contextType: initResult.contextType,
     contextId:   initResult.contextId,
   });

   const dehydratedState = dehydrate(queryClient, {
     // Exclure cocolight-init (non-sérialisable), inclure cocolight-data et loaders
     shouldDehydrateQuery: q => q.queryKey[0] !== "cocolight-init",
   });
   ```

   Deux query keys distinctes sont utilisées :
   - `["cocolight-init"]` : résultat brut de `initApi()`, contient des classes non-JSON-sérialisables (`ApiClient`). **Exclu** de la déshydratation.
   - `["cocolight-data"]` : sous-ensemble sérialisable (`me`, `entity`, `contextType`, `contextId`). **Inclus** dans la déshydratation et transmis au client via `window.__REACT_QUERY_STATE__`.

### Intégration vite-preload

   Le module `vite-preload` trace les composants lazy-loaded et injecte les balises `<link rel="modulepreload">` dans le HTML SSR. Il est initialisé **après** la déshydratation React Query mais **avant** le rendu :

   ```ts
   // Étape 4 : précharger tous les composants lazy
   await preloadAll();

   // Étape 5 : créer le collecteur de chunks
   const collector = createChunkCollector({
     manifest: './dist/client/.vite/manifest.json',
     entry: 'index.html',
   });
   ```

   Le `ChunkCollectorContext` enveloppe l'arbre React pour tracer les chunks utilisés :

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

   Dans `onShellReady`, le serveur extrait les ressources critiques pour le LCP (Largest Contentful Paint) depuis la config et les données des loaders :

   ```ts
   onShellReady() {
     const pathname    = new URL(absUrl).pathname;
     const loaderData  = context.loaderData as Record<string, unknown> | undefined;

     const criticalImages  = extractCriticalImages(cfg, pathname, loaderData);
     const imagePreloadTags = generateImagePreloadTags(criticalImages);

     const criticalFonts  = extractCriticalFonts(cfg);
     const fontPreloadTags = generateFontPreloadTags(criticalFonts);

     const preloadTags = collector.getTags(); // modulepreload des chunks lazy

     onHead(
       `${fontPreloadTags}
        ${imagePreloadTags}
        ${preloadTags}
        ${helmetCtx.helmet?.title ?? ''}
        ${helmetCtx.helmet?.meta  ?? ''}
        ${helmetCtx.helmet?.link  ?? ''}`,
       dehydratedState
     );

     pipe(res as unknown as Writable);
   },
   ```

   * `extractCriticalImages()` : extrait les images critiques depuis la config et les données loaders pour la page courante.
   * `extractCriticalFonts()` : extrait les fonts critiques (Google Fonts) depuis la config du site.
   * `generateImagePreloadTags()` / `generateFontPreloadTags()` : génère les balises `<link rel="preload">` correspondantes.
   * Fonts et images sont injectées **en premier** dans le head pour une priorité maximale.
   * `onHead()` est appelé de manière **synchrone** (sans `await`), avant `pipe()`.

### Pattern `pipe(res)` + override `res.end()` (React 19 + Vite)

   **Contexte architectural :** le template HTML (`index.html`) reste géré par Vite pour bénéficier de `transformIndexHtml` (injection du client HMR en dev, preambles React Fast Refresh, substitution des chunks hashés en prod, hooks des plugins). En conséquence, React ne rend PAS `<html>`/`<body>` dans son arbre et `pipe(res)` n'écrit que le contenu de `<div id="root">`.

   Le pattern officiel React 19 (où `<App>` rend `<html>…</html>`) impose de renoncer à toutes ces transformations Vite. La documentation Vite SSR ne couvre que `renderToString` synchrone — **aucun pattern officiel n'existe pour le streaming avec Vite**.

   **Solution retenue :** `pipe(res)` direct + override de `res.end()` pour injecter les `closingTags` JUSTE AVANT la vraie fermeture :

   ```ts
   const resAny = res as any;
   const originalEnd: (...args: any[]) => unknown = resAny.end.bind(resAny);
   let endIntercepted = false;
   resAny.end = function (...args: any[]) {
     if (!endIntercepted) {
       endIntercepted = true;
       try {
         resAny.write(closingTags);  // inject </div></body></html>
       } catch { /* res déjà fermée */ }
       streamFinished = true;
       setImmediate(() => {
         originalEnd(...args);
         resolve();
       });
       return resAny;
     }
     return originalEnd(...args);
   };

   // ... dans onShellReady :
   pipe(res as unknown as Writable);

   // onAllReady est vide : React 19 appelle res.end() quand TOUT est drainé.
   // L'override ci-dessus intercepte ce point et injecte les closingTags.
   onAllReady() {
     // Rien à faire ici.
   },
   ```

   Points clés de l'implémentation :
   - Le `try/catch` autour de `resAny.write(closingTags)` absorbe silencieusement les cas où la réponse serait déjà fermée (déconnexion client).
   - `setImmediate(() => { originalEnd(); resolve(); })` diffère la fermeture et la résolution de la Promise pour laisser le flush se terminer.
   - `resolve()` est appelé **après** `originalEnd()`, dans le même `setImmediate`.

   **Pourquoi pas un Transform Node intermédiaire ?** Deux approches ont été tentées et échouent :
   - `pipe(appendTransform)` + `appendTransform.end()` dans `onAllReady` : `pipe()` appelle `appendTransform.end()` dès la fin du SHELL, AVANT que les Suspense résolus tardifs soient écrits → HTML tronqué.
   - `PassThrough` avec `end()` override : React Writable bufférise différemment, mêmes symptômes.

   React 19 appelle `res.end()` **uniquement** quand tout est drainé (shell + tous les Suspense résolus + scripts `$RC`). L'override intercepte précisément ce moment.

   > **Gotcha :** ce pattern est non-documenté officiellement (voir entrée dans Known Issues de `CLAUDE.md`). Il fait partie de la tension React 19 ↔ Vite SSR faute de support officiel d'une option `{ end: false }` sur `pipe()`.

   * `onHead` callback injecte fonts, images, preload tags, `<title>`, `<meta>` et le script React Query.
   * Un timeout de 30 secondes (`STREAM_TIMEOUT_MS`) appelle `abort()` pour ne pas bloquer indéfiniment.
   * `bootstrapModules` **n'est pas utilisé** : le `<script type="module" src="/src/entry-client.tsx">` présent dans le template HTML suffit — le rajouter en double provoquerait deux instances du module côté client.

### Gestion des erreurs de stream et timeout

   En plus de l'override `res.end()`, deux gestionnaires supplémentaires protègent le streaming :

   ```ts
   // Erreurs I/O sur la réponse (client déconnecté, réseau coupé…)
   (res as unknown as Writable).on('error', (err: NodeJS.ErrnoException) => {
     if (err.code === 'ERR_STREAM_WRITE_AFTER_END' || err.code === 'ERR_STREAM_DESTROYED') {
       if (!streamFinished) {
         streamFinished = true;
         resolve();
       }
       return;
     }
     console.error('[SSR] Response error:', err);
   });

   // Timeout de sécurité : 30 s max
   const timer = setTimeout(() => {
     console.error('[SSR] STREAM_TIMEOUT_MS atteint — abort() forcé');
     abort();
     resolve();
   }, STREAM_TIMEOUT_MS); // = 30_000

   // Fermeture prématurée de la connexion (client déconnecté)
   res.once('close', () => {
     clearTimeout(timer);
     if (!streamFinished) {
       abort();
       try { (res as unknown as Writable).destroy(); } catch { /* déjà fermée */ }
       resolve();
     }
   });
   ```

   * L'écouteur `error` absorbe les erreurs `ERR_STREAM_WRITE_AFTER_END` / `ERR_STREAM_DESTROYED` sans les relancer (déconnexion client normale).
   * L'écouteur `close` annule le timer et `abort()`e le stream si le client se déconnecte avant la fin du rendu.
   * `onShellError` (callback React) : envoie une 500 et `reject()` la Promise principale.

### Pré-normalisation HTML/SVG : `server/utils/normalizeSiteConfig.js`

   Au boot serveur, **avant** le premier rendu SSR, la config est passée à `normalizeSiteConfig()` pour sanitizer une seule fois tous les champs susceptibles de contenir du HTML/SVG injecté via `dangerouslySetInnerHTML`.

   **Problème sans ce mécanisme :** `jsdom-DOMPurify` (SSR) normalise le HTML légèrement différemment du DOMPurify natif côté client (whitespace, ordre d'attributs, fermeture explicite de tags) → mismatch hydration.

   **Solution :** un seul passage DOMPurify côté serveur au démarrage. SSR et client utilisent ensuite strictement la même chaîne — aucun diff DOM possible.

   ```js
   // server/utils/normalizeSiteConfig.js
   const HTML_FIELDS = new Set([
     "html",      // HTMLSection.props.html
     "svg",       // ContentSection iconCard.svg
     "iconSvg",   // CardsSection items.iconSvg
     "infoText",  // ContentSection (HTML brut)
     "extra",     // DefaultFooter footer.extra
     "content",   // TabsSection/AccordionSection/BlogPostSection/MarkdownSection
     "icon",      // HeroSSBE/HeroRezoLaMer/ActionButtonsRezoLaMer (SVG inline ou nom lucide)
     "logoIcon",  // HeroRezoLaMer props.logoIcon
   ]);

   export function normalizeSiteConfig(value) {
     return walk(value);
   }
   ```

   - Parcours récursif de toute la config.
   - Détection de type : seules les chaînes sont sanitizées ; les objets/arrays sont traversés récursivement.
   - Les `LocalizedString` (`{ fr: "...", en: "..." }`) sont gérées : chaque valeur string est sanitizée individuellement.
   - Pour les champs polymorphes (`content` peut être string HTML ou array de sections, `icon` peut être un nom lucide ou un SVG inline), `normalizeHtmlValue` détecte le type et ne touche pas aux objets/arrays — seules les strings sont sanitizées.
   - Le sanitize côté composants reste actif (défense en profondeur) mais devient **idempotent** (sanitize d'un HTML déjà propre = identique).

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

Ces déclarations permettent à TypeScript de typer correctement les variables globales injectées par le serveur SSR. `window.__ENV__` (injecté par les deux serveurs) est utilisé côté client via `getBaseUrl()` et n'est pas déclaré ici car résolu à la compilation Vite en dev.

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
- Côté serveur: `@dr.pogodin/react-helmet` génère les tags dans `<head>`
- Côté client: `@dr.pogodin/react-helmet` prend le contrôle des tags existants
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

L'import de `@/i18n` est placé **en tout premier** dans `entry-client.tsx`, avant tout autre import React, pour initialiser react-i18next côté client :
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

// 2. Injecter dans le HTML (via la callback onHead)
res.write(`<script>window.__REACT_QUERY_STATE__=${serialize(dehydratedState, { isJSON: true })}</script>`);
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
2. Serveur: Déshydratation → `window.__REACT_QUERY_STATE__` (exclut `cocolight-init`, inclut `cocolight-data` et toutes les queries de loaders)
3. Client: Récupération → Hydratation React Query
4. Client: `useQuery` trouve les données dans le cache → pas de refetch

### Pattern avec initApi singleton

Les loaders utilisent souvent `initApi()` pour initialiser l'API:

```ts
queryFn: async () => {
  const { organization } = await initApi({
    baseURL: getBaseUrl(),
  });
  return organization.entityBySlug(slug);
}
```

**Pourquoi ce pattern ?**
- `initApi()` utilise le **singleton** d'API client (voir Section 8.1)
- Garantit qu'une seule instance API existe par requête SSR
- Partage la connexion, les tokens, et le cache entre loaders
- `resetApiState()` au début de chaque `render()` remet le singleton à zéro entre requêtes

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
// Ne pas déshydrater les queries de type "cocolight-init" (non-sérialisable)
const dehydratedState = dehydrate(queryClient, {
  shouldDehydrateQuery: (query) => query.queryKey[0] !== "cocolight-init"
});
```

**Raison**: `cocolight-init` contient des instances de classes API non JSON-sérialisables. Les données utiles pour le client sont disponibles via `cocolight-data` (sous-ensemble sérialisable).

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

* Un **dev-server** ultra-rapide (HMR + SSR on‑the‑fly, warmup bloquant, hot-reload config avec re-normalisation).
* Un **prod-server** optimisé (gzip, caching long, injection config/env au boot, streaming SSR, HelloAsso API).
* Un **entry-server** robuste (React Router loaders, React Query prefetch + `cocolight-data` sérialisable, streaming avec Helmet, gestion erreurs stream, timeout 30s).
* Un **entry-client** fluide (hydrateRoot, React Query, React Router hydratation, loader masqué après styles).

---

## Voir aussi

- [Architecture](03-architecture.md)
- [API & Auth](11-api-authentification.md)
- [Performance](12-performance.md)
