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
 * Le garde-fou regarde les IMPORTS, pas les appels : on ne peut pas appeler `initApi` sans
 * l'importer, un alias (`initApi as init`), un import d'espace de noms (`* as apiClient`) ou un
 * `import("…/lib/apiClient")` dynamique sont vus, et un commentaire qui cite `initApi()` ne
 * déclenche rien. Même traitement pour `initApiClient`, `getApi`, `getApiClient` et `getUserApi` :
 * côté serveur, chacun refait `createApiInstances()` (la branche serveur ne pose jamais
 * `initialized`) — l'idiome client `await getApi()` dans un loader casserait l'invariant en silence.
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

/** Le module `apiClient`, importé par alias (`@/lib/apiClient`) ou par chemin relatif. */
const API_CLIENT_MODULE = String.raw`["'][^"']*lib\/apiClient["']`;
/** Les entrées de `lib/apiClient` qui créent un `ApiClient` côté serveur. */
const INIT_ENTRYPOINTS = String.raw`\b(?:initApi|initApiClient|getApi|getApiClient|getUserApi)\b`;
/** `import { …, initApi, … } from "…/lib/apiClient"` — avec ou sans alias `initApi as x`. */
const NAMED_INIT_API_IMPORT = new RegExp(
  String.raw`import\s*\{[^}]*` + INIT_ENTRYPOINTS + String.raw`[^}]*\}\s*from\s*` + API_CLIENT_MODULE,
);
/** `import * as x from "…/lib/apiClient"` — donnerait accès à `x.initApi`. */
const NAMESPACE_IMPORT = new RegExp(String.raw`import\s*\*\s*as\s+\w+\s+from\s*` + API_CLIENT_MODULE);
/** `await import("…/lib/apiClient")` — le même module, chargé à la demande. */
const DYNAMIC_IMPORT = new RegExp(String.raw`import\s*\(\s*` + API_CLIENT_MODULE + String.raw`\s*\)`);

export function importeInitApi(source: string): boolean {
  return NAMED_INIT_API_IMPORT.test(source) || NAMESPACE_IMPORT.test(source) || DYNAMIC_IMPORT.test(source);
}

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

  test("le détecteur voit un import direct, aliasé, d'espace de noms ou dynamique, et ignore un commentaire", () => {
    expect(importeInitApi('import { initApi } from "@/lib/apiClient";')).toBe(true);
    expect(importeInitApi('import { getApi } from "@/lib/apiClient";')).toBe(true);
    expect(importeInitApi('import { type InitApiResult, getApiClient, getUserApi } from "@/lib/apiClient";')).toBe(true);
    expect(importeInitApi('import { initApiClient as boot } from "@/lib/apiClient";')).toBe(true);
    expect(importeInitApi('const { getApi } = await import("@/lib/apiClient");')).toBe(true);
    expect(importeInitApi('await import(\n  "../../lib/apiClient"\n);')).toBe(true);
    expect(importeInitApi("import { initApi as init, type InitApiResult } from '@/lib/apiClient';")).toBe(true);
    expect(importeInitApi('import {\n  resetApiState,\n  initApi,\n} from "./lib/apiClient";')).toBe(true);
    expect(importeInitApi('import * as apiClient from "../../lib/apiClient";')).toBe(true);
    expect(importeInitApi('import { resetApiState } from "./lib/apiClient"; // jamais initApi() ici')).toBe(false);
    expect(importeInitApi('import { ensureInitApi } from "@/lib/cocolightInitQuery";')).toBe(false);
  });

  test("aucun import d'`initApi` (ni `getApi` & co.) : tout passe par `ensureInitApi(queryClient)`", () => {
    const offenders = sources
      .filter(({ content }) => importeInitApi(content))
      .map(({ file }) => path.relative(PROJECT_ROOT, file));
    if (offenders.length > 0) {
      console.error(
        "\n❌ `initApi` (ou `getApi`/`getApiClient`/`getUserApi`/`initApiClient`) importé dans le cycle d'une requête SSR :\n" +
          offenders.map((f) => `  - ${f}`).join("\n") +
          "\n\nUtilisez `ensureInitApi(queryClient)` (src/lib/cocolightInitQuery.ts) : une seule init" +
          " API par requête, partagée avec entry-server et les autres loaders.\n",
      );
    }
    expect(offenders).toEqual([]);
  });
});
