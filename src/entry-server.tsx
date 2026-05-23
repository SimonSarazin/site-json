import { type Request, type Response }          from 'express-serve-static-core';
import { renderToPipeableStream }               from 'react-dom/server';
import { HelmetDataContext, HelmetProvider }   from '@dr.pogodin/react-helmet';
import {
  createStaticHandler,
  createStaticRouter,
  StaticRouterProvider,
}                                               from 'react-router';
import { type SiteConfig }                      from '@/types/site';
import { buildRoutes }                          from '@/lib/buildRoutes';
import { Writable } from 'node:stream';
import { dehydrate, type DehydratedState, HydrationBoundary, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { getBaseUrl } from './lib/constant/common';
import { initApi, resetApiState } from './lib/apiClient';
import {
  ChunkCollectorContext,
  createChunkCollector,
  preloadAll
} from 'vite-preload';
import { extractCriticalImages, extractCriticalFonts } from './lib/extractCriticalResources';
import { generateImagePreloadTags, generateFontPreloadTags } from './lib/generatePreloadTags';

const STREAM_TIMEOUT_MS = 30_000;

/* --------------------------------------------------------- */
/*  Fonction principale – aucune logique de substitution ici */
/* --------------------------------------------------------- */
export async function render(
  req: Request,
  res: Response,
  cfg: SiteConfig,
  onHead: (headHtml: string, dehydratedState: DehydratedState) => Promise<void>,
  closingTags = '</div></body></html>',
): Promise<void> {
  const isDev = import.meta.env.DEV;
  const timings: Record<string, string> = {};
  let t0 = isDev ? performance.now() : 0;

  /* Reset de l'état API pour éviter le cache entre requêtes SSR */
  resetApiState();

  /* Remplira title/meta/link dans onShellReady */
  const helmetCtx: HelmetDataContext = {};

  /* 1.  Création du QueryClient AVANT buildRoutes ---------------------- */
  const queryClient = new QueryClient({
    defaultOptions: { queries: { staleTime: 60_000, refetchOnWindowFocus:false } }
  });

  /* 2.  Préparation du routeur statique avec queryClient --------------- */
  if (isDev) t0 = performance.now();
  const handler  = createStaticHandler(await buildRoutes(cfg, queryClient));
  if (isDev) timings.buildRoutes = (performance.now() - t0).toFixed(1);

  const absUrl   = `http://localhost${req.originalUrl ?? req.url ?? '/'}`;

  if (isDev) t0 = performance.now();
  const context  = await handler.query(new Request(absUrl));
  if (isDev) timings.routerQuery = (performance.now() - t0).toFixed(1);

  /* Cas redirection depuis un loader ------------------------------------ */
  if (context instanceof Response) {
    res.status(context.status).set(Object.fromEntries(context.headers));
    res.end(await context.text());
    return;
  }

  const router = createStaticRouter(handler.dataRoutes, context);

  /* 3.  Pré-hydratation React-Query ------------------------------------ */
  // ⬇️  on exécute la requête "cocolight-init" AVANT le rendu
  if (isDev) t0 = performance.now();
  const initResult = await queryClient.ensureQueryData({
    queryKey: ["cocolight-init"],
    queryFn: () => initApi({ baseURL: getBaseUrl() })
  });
  if (isDev) timings.initApi = (performance.now() - t0).toFixed(1);

  // Créer une query SÉRIALISABLE avec les données utiles pour l'hydratation
  // (sans les classes ApiClient, Api qui ne peuvent pas être sérialisées)
  queryClient.setQueryData(["cocolight-data"], {
    me: initResult.me ? initResult.me : null,
    entity: initResult.entity ? initResult.entity : null,
    contextType: initResult.contextType,
    contextId: initResult.contextId,
  });

  const dehydratedState = dehydrate(queryClient, {
    // Exclure cocolight-init (non-sérialisable), mais garder cocolight-data
    shouldDehydrateQuery: q => q.queryKey[0] !== "cocolight-init",
  });

  /* 4.  Précharger tous les composants lazy AVANT le rendu ------------ */
  if (isDev) t0 = performance.now();
  await preloadAll();
  if (isDev) timings.preloadAll = (performance.now() - t0).toFixed(1);

  /* 5.  Créer le collecteur de chunks pour injecter les modulepreload -- */
  const collector = createChunkCollector({
    manifest: './dist/client/.vite/manifest.json',
    entry: 'index.html',
  });

  if (isDev) {
    console.log(`[PERF entry-server] buildRoutes:${timings.buildRoutes}ms | routerQuery:${timings.routerQuery}ms | initApi:${timings.initApi}ms | preloadAll:${timings.preloadAll}ms`);
  }

  /* --------------------------------------------------------- */
  /*  Streaming React 19                                       */
  /* --------------------------------------------------------- */
  await new Promise<void>((resolve, reject) => {
    let streamFinished = false;

    // Approche directe : pipe React → res, mais on intercept `res.end()` pour
    // y injecter les closing tags `</div></body></html>` JUSTE AVANT que la
    // response soit fermée. Pas de Transform/Relay intermédiaire → pas de
    // problème de timing entre les chunks Suspense résolus tardivement.
    //
    // React 19 streaming appelle `res.end()` quand TOUT a été drainé (après
    // tous les Suspense résolus + `$RC` scripts envoyés). C'est là qu'on
    // insère les closing tags.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const resAny = res as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const originalEnd: (...args: any[]) => unknown = resAny.end.bind(resAny);
    let endIntercepted = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resAny.end = function (this: unknown, ...args: any[]) {
      if (!endIntercepted) {
        endIntercepted = true;
        try {
          resAny.write(closingTags);
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

    const { pipe, abort } = renderToPipeableStream(
      <HelmetProvider context={helmetCtx}>
        <ChunkCollectorContext collector={collector}>
          <QueryClientProvider client={queryClient}>
            <HydrationBoundary state={dehydratedState}>
              <StaticRouterProvider router={router} context={context} />
            </HydrationBoundary>
          </QueryClientProvider>
        </ChunkCollectorContext>
      </HelmetProvider>,
      {
        /**
         * ⚠ Pas de `bootstrapModules` — le `<script type="module" src="/src/entry-client.tsx">`
         * du template `index.html` (à la fin du body, dans le `tail`) suffit pour charger
         * le bundle côté client en dev et en prod. Mettre `bootstrapModules: ['/src/entry-client.tsx']`
         * en dev provoque l'injection d'un 2e `<script type="module" src="/src/entry-client.tsx?t=...">`
         * par `transformIndexHtml` de Vite (timestamp anti-cache), ce qui charge le bundle
         * sous deux URLs distinctes → deux instances du module.
         */
        onShellReady() {
          /* ⬇️  head prêt : on délègue son injection au serveur HTTP      */

          /* Extraire le pathname depuis l'URL */
          const pathname = new URL(absUrl).pathname;

          /* Extraire les images critiques pour le LCP (config + données loaders) */
          const loaderData = context.loaderData as Record<string, unknown> | undefined;
          const criticalImages = extractCriticalImages(cfg, pathname, loaderData);
          const imagePreloadTags = generateImagePreloadTags(criticalImages);

          /* Extraire les fonts critiques (Google Fonts) */
          const criticalFonts = extractCriticalFonts(cfg);
          const fontPreloadTags = generateFontPreloadTags(criticalFonts);

          /* Récupérer les tags de preload pour les chunks lazy utilisés   */
          const preloadTags = collector.getTags();

          /* Injecter dans le head (fonts et images EN PREMIER pour priorité maximale) */
          onHead(
            `${fontPreloadTags}
             ${imagePreloadTags}
             ${preloadTags}
             ${helmetCtx.helmet?.title ?? ''}
             ${helmetCtx.helmet?.meta ?? ''}
             ${helmetCtx.helmet?.link ?? ''}`,
             dehydratedState
          );

          /* Pipe direct vers res — l'override de `res.end()` ci-dessus
             ajoutera les closingTags avant la vraie fermeture. */
          pipe(res as unknown as Writable);
        },

        onAllReady() {
          // Rien à faire ici : React 19 appelle `res.end()` après avoir
          // drainé tous les chunks ; l'override `res.end()` plus haut
          // intercepte et écrit les closingTags avant la vraie fermeture.
        },


        onShellError(err) {
          console.error(err);
          res.status(500).end('Erreur serveur');
          reject(err);
        },

        onError(err) {
          console.error('[SSR] Streaming error:', err);
        },
      },
    );

    /* Sécurité : on n'attend pas indéfiniment */
    const timer = setTimeout(() => {
      console.error('[SSR] STREAM_TIMEOUT_MS atteint — abort() forcé');
      abort();
      resolve();
    }, STREAM_TIMEOUT_MS);

    res.once('close', () => {
      clearTimeout(timer);
      if (!streamFinished) {
        // Seulement abort si le stream n'est pas terminé normalement
        abort();
        try { (res as unknown as Writable).destroy(); } catch { /* déjà fermée */ }
        resolve();
      }
    });
  });
}
