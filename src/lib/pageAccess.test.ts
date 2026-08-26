import { describe, it, expect } from "vitest";

import { isGatedPage, gateMode, evaluatePageAccess } from "./pageAccess";

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

describe("gateMode — défaut codé en dur (la config n'est pas parsée par Zod au runtime)", () => {
  it("sans `mode`, une page gardée est en `prompt`", () => {
    expect(gateMode(page({ auth: { required: true } }))).toBe("prompt");
    expect(gateMode(null)).toBe("prompt");
  });
  it("les trois valeurs déclarées sont respectées", () => {
    for (const m of ["prompt", "redirect", "hide"] as const) {
      expect(gateMode(page({ auth: { mode: m } }))).toBe(m);
    }
  });
  it("une valeur inconnue retombe sur le défaut au lieu de casser", () => {
    expect(gateMode(page({ auth: { mode: "bloquer" } }))).toBe("prompt");
  });
});

describe("evaluatePageAccess — la décision partagée par la garde et le renderer", () => {
  const connecte = { isConnected: true, serverData: { roles: { superAdmin: true } } };
  const anonyme = { isConnected: false };

  it("une page publique est toujours accordée, connecté ou non", () => {
    for (const me of [anonyme, connecte, null]) {
      const a = evaluatePageAccess(page({ path: "/contact" }), me);
      expect(a).toMatchObject({ gated: false, granted: true, reason: null });
    }
  });

  it("anonyme sur page gardée : refus pour absence de session", () => {
    const a = evaluatePageAccess(page({ auth: { required: true } }), anonyme);
    expect(a).toMatchObject({ gated: true, granted: false, reason: "anonymous", mode: "prompt" });
  });

  it("connecté sur page gardée sans exigence de rôle : accordé", () => {
    expect(evaluatePageAccess(page({ auth: { required: true } }), connecte).granted).toBe(true);
  });

  it("connecté mais rôle manquant : refus de RÔLE — inutile de proposer une connexion", () => {
    const a = evaluatePageAccess(page({ auth: { roles: ["adminPlatform"] } }), connecte);
    expect(a).toMatchObject({ granted: false, reason: "role" });
  });

  it("connecté avec le bon rôle : accordé", () => {
    expect(evaluatePageAccess(page({ auth: { roles: ["superAdmin"] } }), connecte).granted).toBe(true);
  });

  it("un rôle à `false` ne vaut pas un rôle (le test est `=== true`)", () => {
    const me = { isConnected: true, serverData: { roles: { superAdmin: false } } };
    expect(evaluatePageAccess(page({ auth: { roles: ["superAdmin"] } }), me).granted).toBe(false);
  });

  it("le mode voyage avec la décision", () => {
    const a = evaluatePageAccess(page({ auth: { required: true, mode: "hide" } }), anonyme);
    expect(a.mode).toBe("hide");
  });
});
