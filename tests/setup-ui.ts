/**
 * Setup global pour les tests UI (composants React).
 *
 * - Importe les matchers `@testing-library/jest-dom` (`toBeInTheDocument`, etc.).
 * - Cleanup automatique après chaque test via `@testing-library/react` (déjà géré
 *   par Vitest avec `globals: false` quand on importe le hook explicitement, mais
 *   on l'ajoute en safety net).
 *
 * Chargé par `vitest.config.unit.ts` via `setupFiles`.
 */
import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
});
