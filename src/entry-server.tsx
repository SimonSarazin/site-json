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
import { Writable }                             from 'node:stream';
import { dehydrate, type DehydratedState, HydrationBoundary, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { getBaseUrl } from './lib/constant/common';
import { initApi } from './lib/apiClient';
import {
  ChunkCollectorContext,
  createChunkCollector,
  preloadAll
} from 'vite-preload';

const STREAM_TIMEOUT_MS = 30_000;

/* --------------------------------------------------------- */
/*  Fonction principale – aucune logique de substitution ici */
/* --------------------------------------------------------- */
export async function render(
  req: Request,
  res: Response,
  cfg: SiteConfig,
  onHead: (headHtml: string, dehydratedState: DehydratedState) => Promise<void>,
): Promise<void> {
  /* Remplira title/meta/link dans onShellReady */
  const helmetCtx: HelmetDataContext = {};

  /* 1.  Création du QueryClient AVANT buildRoutes ---------------------- */
  const queryClient = new QueryClient({
    defaultOptions: { queries: { staleTime: 60_000, refetchOnWindowFocus:false } }
  });

  /* 2.  Préparation du routeur statique avec queryClient --------------- */
  const handler  = createStaticHandler(await buildRoutes(cfg, queryClient));
  const absUrl   = `http://localhost${req.originalUrl ?? req.url ?? '/'}`;
  const context  = await handler.query(new Request(absUrl));

  /* Cas redirection depuis un loader ------------------------------------ */
  if (context instanceof Response) {
    res.status(context.status).set(Object.fromEntries(context.headers));
    res.end(await context.text());
    return;
  }

  const router = createStaticRouter(handler.dataRoutes, context);

  /* 3.  Pré-hydratation React-Query ------------------------------------ */
  // ⬇️  on exécute la requête "cocolight-init" AVANT le rendu
  await queryClient.ensureQueryData({
    queryKey: ["cocolight-init"],
    queryFn: () => initApi({ baseURL: getBaseUrl(), debug: true })
  });

  const dehydratedState = dehydrate(queryClient, {
    shouldDehydrateQuery: q => q.queryKey[0] !== "cocolight-init",
  });

  /* 4.  Précharger tous les composants lazy AVANT le rendu ------------ */
  await preloadAll();

  /* 5.  Créer le collecteur de chunks pour injecter les modulepreload -- */
  const collector = createChunkCollector({
    manifest: './dist/client/.vite/manifest.json',
    entry: 'index.html',
  });

  /* --------------------------------------------------------- */
  /*  Streaming React 19                                       */
  /* --------------------------------------------------------- */
  await new Promise<void>((resolve, reject) => {

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
          /* Récupérer les tags de preload pour les chunks lazy utilisés   */
          const preloadTags = collector.getTags();

          onHead(
            `${preloadTags}
             ${helmetCtx.helmet?.title ?? ''}
             ${helmetCtx.helmet?.meta ?? ''}
             ${helmetCtx.helmet?.link ?? ''}`,
             dehydratedState
          );

          /* Express.Response est bien un Writable (cast pour TS)         */
          pipe(res as unknown as Writable);
        },

        onAllReady() {
          res.write("</div></body></html>");                  // </div></body></html>
          res.end();
          resolve();
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
      abort();
      resolve();
    });
  });
}
