import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { applySiteCostum, getSiteCostumContext, withSiteCostumParams } from "./siteCostum";

/**
 * Doublon minimal du client lib. Deux versions cohabitent dans la nature :
 *  - PUBLIÉE : pas de `setSiteCostum`, et un contrat qui ne déclare pas encore `costumSlug` sur les
 *    endpoints mailants → tout doit être NO-OP (les schémas sont en `additionalProperties:false` et
 *    validés en AJV avant l'envoi : poser le champ en aveugle ferait échouer l'appel) ;
 *  - SOURCE : `setSiteCostum` présent, contrat à jour → le trio doit passer.
 */
function client(opts: { withSetter?: boolean; declaresCostum?: boolean; ouvert?: boolean; marque?: boolean } = {}) {
  const calls: Array<{ slug: string; costumId?: string; costumType?: string }> = [];
  return {
    calls,
    ...(opts.withSetter
      ? {
          setSiteCostum(slug: string, o?: { costumId?: string; costumType?: string }) {
            calls.push({ slug, ...o });
          },
        }
      : {}),
    // lib ≥ 1.0.192 : le marqueur du contrat est exposé ; `marque: undefined` = lib publiée (absent)
    ...(opts.marque !== undefined ? { hasCostumContext: () => !!opts.marque } : {}),
    getRequestSchema() {
      const properties = opts.declaresCostum ? { id: {}, costumSlug: {} } : { id: {} };
      // les schémas de requête du contrat sont FERMÉS par défaut (additionalProperties:false)
      return { properties, ...(opts.ouvert ? {} : { additionalProperties: false }) };
    },
  };
}

const CTX = { contextId: "66f2adcfba41c614b86c0af8", contextType: "organizations" };

beforeEach(() => { vi.stubEnv("VITE_SLUG", "institutBleu"); });
afterEach(() => { vi.unstubAllEnvs(); });

describe("getSiteCostumContext", () => {
  it("rend le trio complet quand l'entité porteuse est résolue", () => {
    expect(getSiteCostumContext(CTX)).toEqual({
      costumSlug: "institutBleu",
      costumId: CTX.contextId,
      costumType: CTX.contextType,
    });
  });

  it("rend le SLUG SEUL tant que la résolution réseau n'a pas répondu", () => {
    // Le legacy résout son cache costum sur le slug (`costumCacheParams`) : le slug seul suffit à
    // brander l'e-mail. Attendre id+type ferait retomber sur un mail générique « Communecter ».
    expect(getSiteCostumContext()).toEqual({ costumSlug: "institutBleu" });
  });

  it("rend null sur un déploiement sans costum (VITE_SLUG absent ou « default »)", () => {
    vi.stubEnv("VITE_SLUG", "default");
    expect(getSiteCostumContext(CTX)).toBeNull();
    vi.stubEnv("VITE_SLUG", "");
    expect(getSiteCostumContext(CTX)).toBeNull();
  });
});

describe("applySiteCostum", () => {
  it("pose l'identité costum du site sur le client", () => {
    const c = client({ withSetter: true });
    applySiteCostum(c, CTX);
    expect(c.calls).toEqual([{ slug: "institutBleu", costumId: CTX.contextId, costumType: CTX.contextType }]);
  });

  it("est idempotent — reposable à chaque arrivée du contexte (résolution, login)", () => {
    const c = client({ withSetter: true });
    applySiteCostum(c);
    applySiteCostum(c, CTX);
    expect(c.calls.map((k) => k.slug)).toEqual(["institutBleu", "institutBleu"]);
    expect(c.calls[0].costumId).toBeUndefined();
    expect(c.calls[1].costumId).toBe(CTX.contextId);
  });

  it("ne casse pas sur la lib PUBLIÉE, qui n'expose pas encore setSiteCostum", () => {
    const c = client({ withSetter: false });
    expect(() => applySiteCostum(c, CTX)).not.toThrow();
    expect(c.calls).toHaveLength(0);
  });

  it("ne pose rien sans costum de site", () => {
    vi.stubEnv("VITE_SLUG", "default");
    const c = client({ withSetter: true });
    applySiteCostum(c, CTX);
    expect(c.calls).toHaveLength(0);
  });
});

describe("withSiteCostumParams", () => {
  it("ajoute le trio quand le contrat de l'endpoint déclare costumSlug", () => {
    const c = client({ declaresCostum: true });
    expect(withSiteCostumParams(c, "RELAUNCH_INVITATION", { id: "x" }, CTX)).toEqual({
      id: "x",
      costumSlug: "institutBleu",
      costumId: CTX.contextId,
      costumType: CTX.contextType,
    });
  });

  it("laisse la charge utile INTACTE quand le schéma est FERMÉ et ignore encore le champ (lib publiée)", () => {
    // Régression visée : `additionalProperties:false` + validation AJV côté client ⇒ un `costumSlug`
    // posé en aveugle ferait échouer l'appel en ApiValidationError (bouton cassé) jusqu'à la
    // publication de la lib.
    const c = client({ declaresCostum: false });
    expect(withSiteCostumParams(c, "RELAUNCH_INVITATION", { id: "x" }, CTX)).toEqual({ id: "x" });
  });

  it("pose le trio sur un schéma OUVERT même sans costumSlug déclaré (CREATE_INVITATION_LINK en 1.0.191)", () => {
    // L'AJV n'y refuse rien : ne pas poser le trio désactivait en silence le seul cas où le lien
    // retourné DOIT porter le domaine du costum.
    const c = client({ declaresCostum: false, ouvert: true });
    expect(withSiteCostumParams(c, "CREATE_INVITATION_LINK", { targetId: "t" }, CTX)).toMatchObject({ costumSlug: "institutBleu" });
  });

  it("lib ≥ 1.0.192 : le MARQUEUR décide, pas le schéma", () => {
    // déclare costumSlug (sens métier) mais non marqué → rien ; marqué → trio
    expect(withSiteCostumParams(client({ declaresCostum: true, marque: false }), "GLOBAL_AUTOCOMPLETE_COSTUM", { name: "x" }, CTX)).toEqual({ name: "x" });
    expect(withSiteCostumParams(client({ declaresCostum: false, marque: true }), "RELAUNCH_INVITATION", { id: "x" }, CTX)).toMatchObject({ costumSlug: "institutBleu" });
  });

  it("laisse la charge utile intacte sans costum de site", () => {
    vi.stubEnv("VITE_SLUG", "default");
    const c = client({ declaresCostum: true });
    expect(withSiteCostumParams(c, "RELAUNCH_INVITATION", { id: "x" }, CTX)).toEqual({ id: "x" });
  });
});
