import { describe, test, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Anti-régression bundle — vérifie les gains de perf de la session
 * `9742622 perf(bundle): lazy-load des variants conditionnels + tree-shaking lucide-react`.
 *
 * Skip automatiquement si `dist/client/assets/` n'existe pas (build pas encore lancé).
 * Pour lancer avec build : `npm run build && npm run test:preflight`.
 */

const PROJECT_ROOT = path.resolve(__dirname, "../..");
const ASSETS_DIR = path.join(PROJECT_ROOT, "dist/client/assets");

function hasBuild(): boolean {
  return fs.existsSync(ASSETS_DIR);
}

function listAssets(): string[] {
  if (!hasBuild()) return [];
  return fs.readdirSync(ASSETS_DIR);
}

function fileSize(rel: string): number {
  return fs.statSync(path.join(ASSETS_DIR, rel)).size;
}

describe("Preflight — Bundle size", () => {
  const skipReason = hasBuild() ? null : "dist/client/assets non trouvé — lance `npm run build` d'abord";

  test.skipIf(!hasBuild())(
    "aucun chunk `icons-vendor*.js` (régression manualChunks lucide-react)",
    () => {
      const assets = listAssets();
      const offenders = assets.filter((f) => /^icons-vendor.*\.js$/.test(f));
      if (offenders.length > 0) {
        console.error(
          "\n❌ Régression `icons-vendor` détectée. Chunks à investiguer :\n" +
            offenders.map((f) => `  - ${f} (${(fileSize(f) / 1024).toFixed(0)} KB)`).join("\n") +
            "\n\nLa règle manualChunks sur lucide-react doit être ABSENTE de vite.config.ts.\n"
        );
      }
      expect(offenders).toEqual([]);
    }
  );

  test.skipIf(!hasBuild())(
    "les vendor chunks attendus existent (react, ui, query, form, i18n, utils)",
    () => {
      const assets = listAssets();
      const expectedVendors = [
        /^react-vendor.*\.js$/,
        /^ui-vendor.*\.js$/,
        /^query-vendor.*\.js$/,
        /^form-vendor.*\.js$/,
        /^utils-vendor.*\.js$/,
        /^i18n-vendor.*\.js$/,
      ];
      for (const pattern of expectedVendors) {
        const found = assets.find((f) => pattern.test(f));
        expect(found, `chunk attendu manquant : ${pattern}`).toBeDefined();
      }
    }
  );

  test.skipIf(!hasBuild())(
    "react-vendor chunk reste sous 600 KB (non gzip)",
    () => {
      const reactVendor = listAssets().find((f) => /^react-vendor.*\.js$/.test(f));
      expect(reactVendor).toBeDefined();
      const size = fileSize(reactVendor!);
      const sizeKB = size / 1024;
      // Seuil pragmatique : React 19 + React DOM + React Router v7 ≈ 460 KB
      // non-minified. On laisse 600 KB de marge — alerte si on dépasse,
      // signe qu'on a accidentellement bundlé un autre vendor dedans.
      expect(sizeKB, `react-vendor=${sizeKB.toFixed(0)}KB dépasse 600KB`).toBeLessThan(600);
    }
  );

  test.skipIf(!hasBuild())(
    "le main bundle (index-*.js sans hash 'CDnxngo' = ssr stub) ne dépasse pas 2 MB",
    () => {
      const assets = listAssets();
      const indexChunks = assets.filter((f) => /^index-.*\.js$/.test(f));
      expect(indexChunks.length).toBeGreaterThan(0);
      // prendre le plus gros (typiquement le bundle principal côté client)
      const sizes = indexChunks.map((f) => ({ name: f, size: fileSize(f) }));
      sizes.sort((a, b) => b.size - a.size);
      const main = sizes[0];
      const mainMB = main.size / (1024 * 1024);
      expect(
        mainMB,
        `bundle principal ${main.name} = ${mainMB.toFixed(2)}MB dépasse 2MB`
      ).toBeLessThan(2);
    }
  );

  test.skipIf(!hasBuild())(
    "il existe plus de 500 chunks JS (signe que la lazy-loading fonctionne)",
    () => {
      const jsChunks = listAssets().filter((f) => f.endsWith(".js"));
      // Note : ~1860 chunks attendus avec la stratégie actuelle (lazy components
      // + lucide-react/dynamic icônes individuelles).
      expect(jsChunks.length).toBeGreaterThan(500);
    }
  );

  if (skipReason) {
    test.skip("(les tests bundle-size sont skippés)", () => {});
    // eslint-disable-next-line no-console
    console.warn(`[bundle-size] ${skipReason}`);
  }
});
