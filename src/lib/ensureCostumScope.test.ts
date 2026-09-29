import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { ensureCostumScope } from "./ensureCostumScope";

/** Doublon minimal du carrier lib : mémorise le dernier scope posé. Aucun réseau. */
function carrier(initialScope: string | null) {
  let scope = initialScope;
  return {
    get scope() { return scope; },
    calls: [] as { slug: string; costumId?: string; costumType?: string }[],
    hasCostumScope() { return scope !== null; },
    setCostumScope(slug: string, opts?: { costumId?: string; costumType?: string }) {
      scope = slug;
      this.calls.push({ slug, ...opts });
    },
  };
}

const CTX = { contextId: "66f2adcfba41c614b86c0af8", contextType: "organizations" };

beforeEach(() => { vi.stubEnv("VITE_SLUG", "institutBleu"); });
afterEach(() => { vi.unstubAllEnvs(); });

describe("ensureCostumScope", () => {
  it("pose le slug du site quand l'hôte n'a AUCUN scope (hôte sans source.key)", () => {
    const c = carrier(null);
    ensureCostumScope(c, CTX);
    expect(c.scope).toBe("institutBleu");
    expect(c.calls).toEqual([{ slug: "institutBleu", ...{ costumId: CTX.contextId, costumType: CTX.contextType } }]);
  });

  it("ÉCRASE le scope auto-dérivé d'un `source.key` étranger", () => {
    // Régression : l'hôte `institutBleu` porte `source.key:"meir"`, la lib lui auto-dérive donc le
    // scope « meir ». L'ancienne garde `if (hasCostumScope()) return;` le laissait en place et
    // `validateGroup` postait `costumSlug:"meir"` → `preferences.toBeValidated.meir` au lieu de
    // `.institutBleu` : validation sans aucun effet. 7 des 19 sites de `sites.json` divergent ainsi.
    const c = carrier("meir");
    ensureCostumScope(c, CTX);
    expect(c.scope).toBe("institutBleu");
  });

  it("est idempotent (repose toujours le MÊME slug)", () => {
    const c = carrier("meir");
    ensureCostumScope(c, CTX);
    ensureCostumScope(c, CTX);
    expect(c.calls.map((k) => k.slug)).toEqual(["institutBleu", "institutBleu"]);
  });

  it("ne touche à rien sans slug de site exploitable ou sans contexte", () => {
    const noCtx = carrier("meir");
    ensureCostumScope(noCtx, {});
    expect(noCtx.calls).toHaveLength(0);

    vi.stubEnv("VITE_SLUG", "default");
    const noSlug = carrier("meir");
    ensureCostumScope(noSlug, CTX);
    expect(noSlug.calls).toHaveLength(0);
  });

  it("ignore une entité absente", () => {
    expect(() => ensureCostumScope(null, CTX)).not.toThrow();
    expect(() => ensureCostumScope(undefined, CTX)).not.toThrow();
  });

  it("ignore un objet qui n'est pas un carrier lib", () => {
    // Appelé désormais depuis les factories de mutation de `profil` (membres, demandes de
    // rattachement) : la cible n'est plus garantie être une entité de la lib.
    expect(() => ensureCostumScope({ name: "pas un carrier" }, CTX)).not.toThrow();
  });
});
