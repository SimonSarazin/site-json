import { describe, it, expect } from "vitest";
import { facetCacheTtlMs, SSR_FACET_CACHE_TTL_DEFAULT_MS, SSR_FACET_CACHE_TTL_ENV } from "../facetCache";

/** La lecture de `SSR_FACET_CACHE_TTL_MS` suit le contrat du mémo : `<= 0` désactive. */
describe("facetCacheTtlMs", () => {
  it("absente ou vide → 5 min", () => {
    expect(facetCacheTtlMs({})).toBe(SSR_FACET_CACHE_TTL_DEFAULT_MS);
    expect(facetCacheTtlMs({ [SSR_FACET_CACHE_TTL_ENV]: "" })).toBe(SSR_FACET_CACHE_TTL_DEFAULT_MS);
    expect(facetCacheTtlMs({ [SSR_FACET_CACHE_TTL_ENV]: "   " })).toBe(SSR_FACET_CACHE_TTL_DEFAULT_MS);
    expect(SSR_FACET_CACHE_TTL_DEFAULT_MS).toBe(300_000);
  });

  it("`0` ET toute valeur négative désactivent (0), comme `createSsrMemo` l'entend", () => {
    expect(facetCacheTtlMs({ [SSR_FACET_CACHE_TTL_ENV]: "0" })).toBe(0);
    expect(facetCacheTtlMs({ [SSR_FACET_CACHE_TTL_ENV]: "-1" })).toBe(0);
    expect(facetCacheTtlMs({ [SSR_FACET_CACHE_TTL_ENV]: "-300000" })).toBe(0);
  });

  it("une valeur positive est prise telle quelle (ms)", () => {
    expect(facetCacheTtlMs({ [SSR_FACET_CACHE_TTL_ENV]: "1000" })).toBe(1000);
    expect(facetCacheTtlMs({ [SSR_FACET_CACHE_TTL_ENV]: " 60000 " })).toBe(60_000);
  });

  it("une valeur illisible retombe sur le défaut plutôt que d'éteindre le cache en silence", () => {
    expect(facetCacheTtlMs({ [SSR_FACET_CACHE_TTL_ENV]: "cinq minutes" })).toBe(SSR_FACET_CACHE_TTL_DEFAULT_MS);
    expect(facetCacheTtlMs({ [SSR_FACET_CACHE_TTL_ENV]: "Infinity" })).toBe(SSR_FACET_CACHE_TTL_DEFAULT_MS);
  });
});
