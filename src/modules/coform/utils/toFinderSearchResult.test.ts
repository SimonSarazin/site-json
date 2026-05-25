import { describe, it, expect } from "vitest";
import type { SearchEntity } from "@communecter/cocolight-api-client";
import { toFinderSearchResult } from "./toFinderSearchResult";

/**
 * Helper : on simule une instance SDK minimale en exposant `id` (getter natif
 * BaseEntity) et `serverData` (objet brut). Le type-cast vers `SearchEntity`
 * est volontaire pour les tests — l'objet n'a pas besoin d'être un vrai Proxy
 * réactif SDK pour que la fonction pure marche.
 */
function makeEntity(id: string | null, data: Record<string, unknown>): SearchEntity {
  return { id, serverData: data } as unknown as SearchEntity;
}

describe("toFinderSearchResult", () => {
  describe("champs nominaux", () => {
    it("extrait id depuis entity.id (getter SDK)", () => {
      const e = makeEntity("507f1f77bcf86cd799439011", { name: "Org A" });
      const out = toFinderSearchResult(e, "organizations");
      expect(out.id).toBe("507f1f77bcf86cd799439011");
    });

    it("renvoie id vide si entity.id est null", () => {
      const e = makeEntity(null, { name: "X" });
      expect(toFinderSearchResult(e, "organizations").id).toBe("");
    });

    it("extrait name depuis serverData.name", () => {
      const e = makeEntity("1", { name: "Tiers-lieu Marseille" });
      expect(toFinderSearchResult(e, "organizations").name).toBe(
        "Tiers-lieu Marseille"
      );
    });

    it("renvoie name vide si absent", () => {
      const e = makeEntity("1", {});
      expect(toFinderSearchResult(e, "organizations").name).toBe("");
    });
  });

  describe("type — résolution en cascade", () => {
    it("priorité 1 : serverData.collection", () => {
      const e = makeEntity("1", { collection: "events", type: "Cooperative" });
      expect(toFinderSearchResult(e, "organizations").type).toBe("events");
    });

    it("priorité 2 : serverData.type si collection absent", () => {
      const e = makeEntity("1", { type: "Cooperative" });
      expect(toFinderSearchResult(e, "organizations").type).toBe("Cooperative");
    });

    it("priorité 3 : fallbackType si rien dans serverData", () => {
      const e = makeEntity("1", {});
      expect(toFinderSearchResult(e, "projects").type).toBe("projects");
    });

    it("ignore collection si non-string", () => {
      const e = makeEntity("1", { collection: 42 });
      expect(toFinderSearchResult(e, "events").type).toBe("events");
    });
  });

  describe("champs optionnels", () => {
    it("profilThumbImageUrl renvoyé si string", () => {
      const e = makeEntity("1", {
        name: "X",
        profilThumbImageUrl: "https://api/img.jpg",
      });
      expect(toFinderSearchResult(e, "organizations").profilThumbImageUrl).toBe(
        "https://api/img.jpg"
      );
    });

    it("profilThumbImageUrl = undefined si absent", () => {
      const e = makeEntity("1", { name: "X" });
      expect(toFinderSearchResult(e, "organizations").profilThumbImageUrl).toBeUndefined();
    });

    it("profilThumbImageUrl = undefined si non-string", () => {
      const e = makeEntity("1", { profilThumbImageUrl: null });
      expect(toFinderSearchResult(e, "organizations").profilThumbImageUrl).toBeUndefined();
    });

    it("email renvoyé si string", () => {
      const e = makeEntity("1", { email: "a@b.c" });
      expect(toFinderSearchResult(e, "organizations").email).toBe("a@b.c");
    });

    it("email = undefined si absent", () => {
      const e = makeEntity("1", {});
      expect(toFinderSearchResult(e, "organizations").email).toBeUndefined();
    });

    it("address renvoyée si objet", () => {
      const e = makeEntity("1", {
        address: {
          streetAddress: "1 rue X",
          postalCode: "13001",
          addressLocality: "Marseille",
        },
      });
      expect(toFinderSearchResult(e, "organizations").address).toEqual({
        streetAddress: "1 rue X",
        postalCode: "13001",
        addressLocality: "Marseille",
      });
    });

    it("address = undefined si non-objet", () => {
      const e = makeEntity("1", { address: "1 rue X" });
      expect(toFinderSearchResult(e, "organizations").address).toBeUndefined();
    });
  });

  describe("serverData absent / vide", () => {
    it("ne crash pas si serverData est undefined", () => {
      const e = { id: "1", serverData: undefined } as unknown as SearchEntity;
      expect(() => toFinderSearchResult(e, "organizations")).not.toThrow();
      const out = toFinderSearchResult(e, "organizations");
      expect(out).toEqual({
        id: "1",
        name: "",
        type: "organizations",
        profilThumbImageUrl: undefined,
        email: undefined,
        address: undefined,
      });
    });

    it("ne crash pas si serverData est {}", () => {
      const e = makeEntity("1", {});
      const out = toFinderSearchResult(e, "citoyens");
      expect(out.id).toBe("1");
      expect(out.type).toBe("citoyens");
    });
  });

  describe("entité complète typique", () => {
    it("résultat final cohérent avec FinderSearchResult", () => {
      const e = makeEntity("507f1f77bcf86cd799439011", {
        name: "Tiers-lieu La Friche",
        collection: "organizations",
        profilThumbImageUrl: "https://api.example/upload/thumb.jpg",
        email: "contact@lafriche.fr",
        address: {
          streetAddress: "41 rue Jobin",
          postalCode: "13003",
          addressLocality: "Marseille",
        },
        // champs additionnels ignorés par le mapper :
        description: "Une friche...",
        slug: "la-friche",
      });
      expect(toFinderSearchResult(e, "events")).toEqual({
        id: "507f1f77bcf86cd799439011",
        name: "Tiers-lieu La Friche",
        type: "organizations",
        profilThumbImageUrl: "https://api.example/upload/thumb.jpg",
        email: "contact@lafriche.fr",
        address: {
          streetAddress: "41 rue Jobin",
          postalCode: "13003",
          addressLocality: "Marseille",
        },
      });
    });
  });
});
