import path from "path";
import { defineConfig } from "vitest/config";

/**
 * Config vitest pour les tests "unit" (pures fonctions + composants stateless).
 *
 * Stratégie d'environnement :
 *  - Default `environment: "node"` (le plus rapide) pour la majorité des fichiers.
 *  - Override par-fichier via `// @vitest-environment jsdom` pour les composants
 *    React qui ont besoin du DOM (`*.test.tsx` testant du JSX).
 *  - `setupFiles` chargé pour tous les tests — les imports `@testing-library/jest-dom`
 *    sont sûrs côté node (les matchers ne se déclenchent que dans les expects),
 *    et `cleanup()` est no-op sans container DOM monté.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    setupFiles: ["./tests/setup-ui.ts"],
    include: [
      "src/**/*.test.ts",
      "src/**/*.test.tsx",
      "tests/preflight/**/*.test.ts",
      "server/**/*.test.ts",
    ],
  },
});
