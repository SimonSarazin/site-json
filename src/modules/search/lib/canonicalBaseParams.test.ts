import { describe, it, expect } from "vitest";
import { canonicalSearchProStaticBaseParams } from "./canonicalBaseParams";

/**
 * Tests de `canonicalSearchProStaticBaseParams` — source unique de la forme
 * canonique des `baseParams` envoyés à `useSearchQuery` côté SSR ET client.
 *
 * Critique : la queryKey React Query sérialise ce shape via JSON.stringify.
 * Toute différence entre SSR et client casse le cache hit post-hydratation
 * et provoque un refetch (et historiquement un #418 React).
 */

describe("canonicalSearchProStaticBaseParams", () => {
  describe("shape par défaut", () => {
    it("inclut defaultFilters: {} même si pas fourni", () => {
      const result = canonicalSearchProStaticBaseParams({});
      expect(result).toHaveProperty("defaultFilters");
      expect(result.defaultFilters).toEqual({});
    });

    it("inclut locality: {} même si pas fourni", () => {
      const result = canonicalSearchProStaticBaseParams({});
      expect(result).toHaveProperty("locality");
      expect(result.locality).toEqual({});
    });

    it("retourne un objet avec exactement les clés attendues pour input vide", () => {
      const result = canonicalSearchProStaticBaseParams({});
      expect(Object.keys(result).sort()).toEqual(["defaultFilters", "locality"]);
    });
  });

  describe("spread de raw", () => {
    it("préserve les clés arbitraires de raw", () => {
      const result = canonicalSearchProStaticBaseParams({
        searchTypes: ["organizations"],
        scope: "global",
      });
      expect(result.searchTypes).toEqual(["organizations"]);
      expect(result.scope).toBe("global");
    });

    it("ne perd pas raw.defaultFilters si fourni — il est mergé", () => {
      const result = canonicalSearchProStaticBaseParams({
        defaultFilters: { tag: ["foo"] },
      });
      expect(result.defaultFilters).toEqual({ tag: ["foo"] });
    });
  });

  describe("merge filters", () => {
    it("filters sont mergés dans defaultFilters", () => {
      const result = canonicalSearchProStaticBaseParams(
        { defaultFilters: { tag: ["foo"] } },
        { type: ["organizations"] }
      );
      expect(result.defaultFilters).toEqual({
        tag: ["foo"],
        type: ["organizations"],
      });
    });

    it("filters override raw.defaultFilters sur les clés en collision", () => {
      const result = canonicalSearchProStaticBaseParams(
        { defaultFilters: { tag: ["foo"] } },
        { tag: ["bar"] }
      );
      expect(result.defaultFilters).toEqual({ tag: ["bar"] });
    });

    it("filters vides → defaultFilters reflète juste raw.defaultFilters", () => {
      const result = canonicalSearchProStaticBaseParams(
        { defaultFilters: { tag: ["foo"] } },
        {}
      );
      expect(result.defaultFilters).toEqual({ tag: ["foo"] });
    });
  });

  describe("locality", () => {
    it("locality fourni remplace le défaut", () => {
      const result = canonicalSearchProStaticBaseParams({}, {}, { city: "Paris" });
      expect(result.locality).toEqual({ city: "Paris" });
    });

    it("locality n'est pas mergé dans defaultFilters", () => {
      const result = canonicalSearchProStaticBaseParams({}, {}, { city: "Paris" });
      expect(result.defaultFilters).toEqual({});
      expect(result.locality).toEqual({ city: "Paris" });
    });
  });

  describe("idempotence", () => {
    it("deux appels avec les mêmes args produisent un résultat identique", () => {
      const a = canonicalSearchProStaticBaseParams(
        { searchTypes: ["x"], defaultFilters: { k: ["v"] } },
        { extra: "yes" },
        { city: "Lyon" }
      );
      const b = canonicalSearchProStaticBaseParams(
        { searchTypes: ["x"], defaultFilters: { k: ["v"] } },
        { extra: "yes" },
        { city: "Lyon" }
      );
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    });

    it("shape SSR (sans args dynamiques) identique au shape client (avec args vides)", () => {
      // SSR : prefetch initial, pas de filters/locality dynamiques disponibles
      const ssr = canonicalSearchProStaticBaseParams({ searchTypes: ["x"] });
      // Client : SearchProStatic appelle avec des objets vides au render initial
      const client = canonicalSearchProStaticBaseParams({ searchTypes: ["x"] }, {}, {});
      expect(JSON.stringify(ssr)).toBe(JSON.stringify(client));
    });
  });
});
