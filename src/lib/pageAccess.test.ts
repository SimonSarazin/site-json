import { describe, it, expect } from "vitest";

import { isGatedPage } from "./pageAccess";

type P = Parameters<typeof isGatedPage>[0];
const page = (o: Record<string, unknown>) => o as unknown as P;

describe("isGatedPage — qu'est-ce qu'une page gardée", () => {
  it("une page sans auth ni middleware est publique", () => {
    expect(isGatedPage(page({ path: "/contact" }))).toBe(false);
    expect(isGatedPage(null)).toBe(false);
    expect(isGatedPage(undefined)).toBe(false);
  });

  it("auth.required: true garde la page", () => {
    expect(isGatedPage(page({ auth: { required: true } }))).toBe(true);
  });

  it("auth.required: false ne garde rien", () => {
    // Le cas du `.default(false)` Zod écrit explicitement en config.
    expect(isGatedPage(page({ auth: { required: false } }))).toBe(false);
  });

  it("auth.roles non vide garde la page, un tableau VIDE non", () => {
    expect(isGatedPage(page({ auth: { roles: ["superAdmin"] } }))).toBe(true);
    expect(isGatedPage(page({ auth: { roles: [] } }))).toBe(false);
  });

  it("les middlewares auth-required et admin-only gardent la page", () => {
    expect(isGatedPage(page({ middleware: ["auth-required"] }))).toBe(true);
    expect(isGatedPage(page({ middleware: ["admin-only"] }))).toBe(true);
  });

  it("redirect-if-authenticated ne garde PAS : il éloigne un connecté d'une page publique", () => {
    expect(isGatedPage(page({ middleware: ["redirect-if-authenticated"] }))).toBe(false);
  });

  it("un nom de middleware inconnu ne garde rien (le registre l'ignore aussi)", () => {
    // `registry[mw]?.()` — un nom hors registre est un no-op silencieux : la page n'est pas gardée.
    expect(isGatedPage(page({ middleware: ["admin-required"] }))).toBe(false);
  });

  it("cumul auth + middleware", () => {
    expect(isGatedPage(page({ auth: { required: true }, middleware: ["admin-only"] }))).toBe(true);
  });
});
