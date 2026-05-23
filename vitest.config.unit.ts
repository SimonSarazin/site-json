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
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
      reportsDirectory: "./coverage",
      include: ["src/**/*.{ts,tsx}", "server/**/*.{js,ts}"],
      exclude: [
        "**/*.test.{ts,tsx}",
        "**/__tests__/**",
        "**/types/**",
        "**/*.d.ts",
        "src/entry-server.tsx",
        "src/entry-client.tsx",
        "src/main.tsx",
        "**/*.config.{ts,js}",
        "**/i18n/**",
      ],
    },
  },
});
