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

const STREAM_TIMEOUT_MS = 10_000;

/* --------------------------------------------------------- */
/*  Fonction principale – aucune logique de substitution ici */
/* --------------------------------------------------------- */
export async function render(
  req: Request,
  res: Response,
  cfg: SiteConfig,
  onHead: (headHtml: string) => Promise<void>,
): Promise<void> {
  /* Remplira title/meta/link dans onShellReady */
  const helmetCtx: HelmetDataContext = {};

  /* Préparation du routeur statique */
  const handler  = createStaticHandler(buildRoutes(cfg));
  const absUrl   = `http://localhost${req.originalUrl ?? req.url ?? '/'}`;
  const context  = await handler.query(new Request(absUrl));

  /* Cas redirection depuis un loader ------------------------------------ */
  if (context instanceof Response) {
    res.status(context.status).set(Object.fromEntries(context.headers));
    res.end(await context.text());
    return;
  }

  const router = createStaticRouter(handler.dataRoutes, context);

  /* --------------------------------------------------------- */
  /*  Streaming React 19                                       */
  /* --------------------------------------------------------- */
  await new Promise<void>((resolve, reject) => {
    const { pipe, abort } = renderToPipeableStream(
      <HelmetProvider context={helmetCtx}>
        <StaticRouterProvider router={router} context={context} />
      </HelmetProvider>,
      {
        /* Module ESM en dev, script classique en prod */
        bootstrapModules:['/src/entry-client.tsx'],
        onShellReady() {
          /* ⬇️  head prêt : on délègue son injection au serveur HTTP      */
          onHead(
            `${helmetCtx.helmet?.title ?? ''}
             ${helmetCtx.helmet?.meta ?? ''}
             ${helmetCtx.helmet?.link ?? ''}`
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
