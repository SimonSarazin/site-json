import { describe, test, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Anti-régression — le code qui tourne PENDANT une requête SSR (entry-server, loaders de routes,
 * préchargements) ne doit jamais appeler `initApi()` directement : il passe par `ensureInitApi`
 * (`src/lib/cocolightInitQuery.ts`), l'entrée React Query `["cocolight-init"]` du `QueryClient`
 * de la requête.
 *
 * Chaque `initApi()` direct crée un `ApiClient` de plus et refait la résolution de l'entité
 * porteuse (`getinfo/key` + `element/about`, 51 Ko) : mesuré sur tiers-lieux `/lieux` avant le
 * partage, 6 inits et 17 appels backend par page servie au lieu de 1 et 7.
 *
 * Hors périmètre, volontairement : `src/hooks/useCocolightInit.ts` (client, lit la même clé via
 * `useSuspenseQuery`) et `src/modules/blog/server/feed.ts` (`/blog/feed.xml`, un point d'entrée
 * HTTP à part, sans `QueryClient`).
 */

const PROJECT_ROOT = path.resolve(__dirname, "../..");
const SRC = path.join(PROJECT_ROOT, "src");

/** Fichiers et dossiers qui s'exécutent dans le cycle d'une requête SSR. */
const SSR_SCOPE = [
  path.join(SRC, "entry-server.tsx"),
  path.join(SRC, "lib", "buildRoutes.tsx"),
  ...fs.readdirSync(path.join(SRC, "modules"), { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .flatMap((d) => [
      path.join(SRC, "modules", d.name, "routes.tsx"),
      path.join(SRC, "modules", d.name, "prefetch"),
    ]),
];

function sourcesDe(entry: string, files: string[] = []): string[] {
  if (!fs.existsSync(entry)) return files;
  if (fs.statSync(entry).isDirectory()) {
    for (const e of fs.readdirSync(entry)) sourcesDe(path.join(entry, e), files);
  } else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
    files.push(entry);
  }
  return files;
}

const DIRECT_INIT = /\binitApi\s*\(/;

describe("Preflight — une seule init API par requête SSR", () => {
  const sources = SSR_SCOPE.flatMap((e) => sourcesDe(e))
    .map((file) => ({ file, content: fs.readFileSync(file, "utf-8") }));

  test("le périmètre couvre bien les loaders connus", () => {
    const rel = sources.map(({ file }) => path.relative(PROJECT_ROOT, file));
    expect(rel).toEqual(expect.arrayContaining([
      "src/entry-server.tsx",
      "src/lib/buildRoutes.tsx",
      "src/modules/search/prefetch/prefetchFilters.ts",
      "src/modules/search/prefetch/prefetchSearchResults.ts",
      "src/modules/profil/prefetch/prefetchProfile.ts",
      "src/modules/blog/prefetch/prefetchArticle.ts",
      "src/modules/aac/prefetch/prefetchCommun.ts",
    ]));
  });

  test("aucun `initApi(` direct : tout passe par `ensureInitApi(queryClient)`", () => {
    const offenders = sources
      .filter(({ content }) => DIRECT_INIT.test(content))
      .map(({ file }) => path.relative(PROJECT_ROOT, file));
    if (offenders.length > 0) {
      console.error(
        "\n❌ `initApi()` appelé directement dans le cycle d'une requête SSR :\n" +
          offenders.map((f) => `  - ${f}`).join("\n") +
          "\n\nUtilisez `ensureInitApi(queryClient)` (src/lib/cocolightInitQuery.ts) : une seule init" +
          " API par requête, partagée avec entry-server et les autres loaders.\n",
      );
    }
    expect(offenders).toEqual([]);
  });
});
