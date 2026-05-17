import { describe, expect, it } from "vitest";
import { collectAvailableTags, filterCards } from "./cardFilters";
import type { MeeteemCard } from "../types";

/**
 * Tests unitaires pour les helpers de filtrage `MeeteemSection`.
 * Pure functions extraites au Sprint Ampli pour la testabilité.
 */

function makeCard(opts: {
  id: string;
  name?: string;
  tags?: string[];
  userName?: string;
}): MeeteemCard {
  return {
    answer: {
      serverData: {
        id: opts.id,
        created: new Date("2026-05-01"),
      },
    },
    data: {
      name: opts.name ?? `Card ${opts.id}`,
      tags: opts.tags,
    },
    user: opts.userName
      ? { name: opts.userName, initial: opts.userName.charAt(0), exists: true }
      : undefined,
  };
}

describe("collectAvailableTags", () => {
  it("retourne tableau vide si aucune carte", () => {
    expect(collectAvailableTags([])).toEqual([]);
  });

  it("retourne tableau vide si cartes sans tags", () => {
    const cards = [makeCard({ id: "1" }), makeCard({ id: "2" })];
    expect(collectAvailableTags(cards)).toEqual([]);
  });

  it("collecte les tags d'une seule carte", () => {
    const cards = [makeCard({ id: "1", tags: ["a", "b", "c"] })];
    expect(collectAvailableTags(cards)).toEqual(["a", "b", "c"]);
  });

  it("déduplique les tags partagés entre plusieurs cartes", () => {
    const cards = [
      makeCard({ id: "1", tags: ["a", "b"] }),
      makeCard({ id: "2", tags: ["b", "c"] }),
      makeCard({ id: "3", tags: ["c", "d"] }),
    ];
    expect(collectAvailableTags(cards)).toEqual(["a", "b", "c", "d"]);
  });

  it("préserve l'ordre d'apparition des tags", () => {
    const cards = [
      makeCard({ id: "1", tags: ["zebra", "apple"] }),
      makeCard({ id: "2", tags: ["mango"] }),
    ];
    expect(collectAvailableTags(cards)).toEqual(["zebra", "apple", "mango"]);
  });

  it("ignore les cartes sans tags mais collecte les autres", () => {
    const cards = [
      makeCard({ id: "1", tags: ["a"] }),
      makeCard({ id: "2" }),
      makeCard({ id: "3", tags: ["b"] }),
    ];
    expect(collectAvailableTags(cards)).toEqual(["a", "b"]);
  });
});

describe("filterCards", () => {
  const cards = [
    makeCard({ id: "1", name: "Card A", tags: ["food", "drink"], userName: "Alice" }),
    makeCard({ id: "2", name: "Card B", tags: ["food"], userName: "Bob" }),
    makeCard({ id: "3", name: "Card C", tags: ["music"], userName: "Alice" }),
    makeCard({ id: "4", name: "Card D", userName: "Charlie" }),
  ];

  it("retourne toutes les cartes si aucun filtre", () => {
    expect(filterCards(cards, [], null)).toEqual(cards);
  });

  describe("filtre par tags", () => {
    it("garde uniquement les cartes ayant un des tags actifs", () => {
      const result = filterCards(cards, ["food"], null);
      expect(result).toHaveLength(2);
      expect(result.map((c) => c.answer.serverData.id)).toEqual(["1", "2"]);
    });

    it("OR logic entre plusieurs tags actifs", () => {
      const result = filterCards(cards, ["food", "music"], null);
      expect(result).toHaveLength(3);
      expect(result.map((c) => c.answer.serverData.id)).toEqual(["1", "2", "3"]);
    });

    it("exclut les cartes sans tags si filtres actifs", () => {
      const result = filterCards(cards, ["food"], null);
      expect(result.map((c) => c.answer.serverData.id)).not.toContain("4");
    });

    it("retourne tableau vide si aucun match", () => {
      expect(filterCards(cards, ["nonexistent"], null)).toEqual([]);
    });
  });

  describe("filtre par utilisateur", () => {
    it("garde uniquement les cartes du user spécifié", () => {
      const result = filterCards(cards, [], "Alice");
      expect(result).toHaveLength(2);
      expect(result.map((c) => c.answer.serverData.id)).toEqual(["1", "3"]);
    });

    it("retourne tableau vide pour un user inexistant", () => {
      expect(filterCards(cards, [], "Nobody")).toEqual([]);
    });
  });

  describe("combinaison tags + user (AND logic)", () => {
    it("garde uniquement les cartes matchant les deux filtres", () => {
      const result = filterCards(cards, ["food"], "Alice");
      expect(result).toHaveLength(1);
      expect(result[0].answer.serverData.id).toBe("1");
    });

    it("retourne tableau vide si user existe mais pas avec ce tag", () => {
      // Alice a "food" et "music" mais Bob n'a pas "music"
      expect(filterCards(cards, ["music"], "Bob")).toEqual([]);
    });
  });
});
