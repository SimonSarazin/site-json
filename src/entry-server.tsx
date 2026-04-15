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
import { Writable, Transform }                  from 'node:stream';
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

    // Transform stream qui ajoute les closing tags automatiquement
    // quand le pipe React se termine (via flush)
    const appendTransform = new Transform({
      transform(chunk, _encoding, callback) {
        callback(null, chunk);
      },
      flush(callback) {
        this.push(closingTags);
        callback();
      },
    });

    // Quand le transform stream se termine, on résout la promesse
    appendTransform.on('finish', () => {
      streamFinished = true;
      resolve();
    });

    appendTransform.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'ERR_STREAM_WRITE_AFTER_END' || err.code === 'ERR_STREAM_DESTROYED') {
        resolve();
        return;
      }
      console.error('[SSR] Transform error:', err);
      reject(err);
    });

    // Pipe le transform vers la response
    appendTransform.pipe(res as unknown as Writable);
    (res as unknown as Writable).on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'ERR_STREAM_WRITE_AFTER_END' || err.code === 'ERR_STREAM_DESTROYED') return;
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
        /* Module ESM en dev, script classique en prod */
        bootstrapModules:
          process.env.NODE_ENV === 'development'
            ? ['/src/entry-client.tsx']
            : [],
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

          /* Pipe vers le transform qui ajoutera les closing tags */
          pipe(appendTransform);
        },

  onAllReady() {
    // Terminer le transform stream, ce qui déclenchera flush()
    // et ajoutera les closing tags automatiquement
    appendTransform.end();
  },


        onShellError(err) {
          console.error(err);
          res.status(500).end('Erreur serveur');
          reject(err);
        },

        onError(err) {
          console.error('Streaming error', err);
        },
      },
    );

    /* Sécurité : on n’attend pas indéfiniment */
    const timer = setTimeout(() => {
      abort();
      resolve();
    }, STREAM_TIMEOUT_MS);

    res.once('close', () => {
      clearTimeout(timer);
      if (!streamFinished) {
        // Seulement abort si le stream n'est pas terminé normalement
        abort();
        appendTransform.destroy();
        resolve();
      }
    });
  });
}
