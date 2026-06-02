import { describe, expect, it } from "vitest";
import { getSummaryData, type AmpliDataResponse } from "./summary";

/**
 * Tests unitaires pour `getSummaryData` — agrège les compteurs (réponses,
 * users uniques, likes, comments) à partir d'une liste de réponses Cocolight.
 *
 * Le code utilise des casts non-stricts vers `User` (SDK) pour accéder à
 * `voteCount.like` et `comments` côté `serverData`. Les tests construisent
 * des objets minimaux qui matchent ces accès.
 */

type ServerDataLike = {
  _id?: string;
  user?: { serverData: { _id: string } };
  voteCount?: { like?: number };
  comments?: Record<string, unknown>;
};

function makeItem(serverData: ServerDataLike): AmpliDataResponse {
  return {
    // Cast structurel : `Answer` (SDK entity) a ~170 propriétés/méthodes ;
    // les tests n'utilisent que `serverData`, donc on passe par `unknown` pour ne
    // pas reconstruire toute l'entité.
    answer: { serverData } as unknown as AmpliDataResponse["answer"],
    data: {},
  };
}

describe("getSummaryData", () => {
  it("retourne des compteurs à 0 pour un tableau vide", () => {
    const result = getSummaryData([]);
    expect(result).toEqual({
      totalAnswers: 0,
      totalUsers: 0,
      totalLikes: 0,
      totalComments: 0,
      users: [],
    });
  });

  describe("totalAnswers", () => {
    it("compte le nombre total de réponses", () => {
      const data = [makeItem({}), makeItem({}), makeItem({})];
      expect(getSummaryData(data).totalAnswers).toBe(3);
    });
  });

  describe("totalLikes", () => {
    it("compte 1 par réponse avec voteCount.like > 0", () => {
      const data = [
        makeItem({ voteCount: { like: 3 } }),
        makeItem({ voteCount: { like: 5 } }),
      ];
      expect(getSummaryData(data).totalLikes).toBe(2);
    });

    it("ignore voteCount.like === 0", () => {
      const data = [makeItem({ voteCount: { like: 0 } })];
      expect(getSummaryData(data).totalLikes).toBe(0);
    });

    it("ignore voteCount absent", () => {
      expect(getSummaryData([makeItem({})]).totalLikes).toBe(0);
    });
  });

  describe("totalComments", () => {
    it("compte 1 par réponse avec au moins un comment", () => {
      const data = [
        makeItem({ comments: { c1: {}, c2: {} } }),
        makeItem({ comments: { c1: {} } }),
      ];
      expect(getSummaryData(data).totalComments).toBe(2);
    });

    it("ignore les objets comments vides", () => {
      expect(getSummaryData([makeItem({ comments: {} })]).totalComments).toBe(0);
    });

    it("ignore comments absent", () => {
      expect(getSummaryData([makeItem({})]).totalComments).toBe(0);
    });
  });

  describe("totalUsers + users", () => {
    it("compte 1 par user unique (clé _id)", () => {
      const data = [
        makeItem({ user: { serverData: { _id: "u1" } } }),
        makeItem({ user: { serverData: { _id: "u2" } } }),
      ];
      const result = getSummaryData(data);
      expect(result.totalUsers).toBe(2);
      expect(result.users).toHaveLength(2);
    });

    it("agrège les contributions du même user", () => {
      const data = [
        makeItem({ user: { serverData: { _id: "u1" } } }),
        makeItem({ user: { serverData: { _id: "u1" } } }),
        makeItem({ user: { serverData: { _id: "u1" } } }),
      ];
      const result = getSummaryData(data);
      expect(result.totalUsers).toBe(1);
      expect(result.users[0].contributionCount).toBe(3);
    });

    it("groupe correctement plusieurs users", () => {
      const data = [
        makeItem({ user: { serverData: { _id: "u1" } } }),
        makeItem({ user: { serverData: { _id: "u2" } } }),
        makeItem({ user: { serverData: { _id: "u1" } } }),
      ];
      const result = getSummaryData(data);
      expect(result.totalUsers).toBe(2);
      const u1 = result.users.find(
        (u) =>
          typeof u.user === "object" &&
          u.user !== null &&
          "serverData" in u.user &&
          (u.user.serverData as { _id?: string })._id === "u1",
      );
      expect(u1?.contributionCount).toBe(2);
    });

    it("traite les items sans user comme un groupe distinct", () => {
      const data = [makeItem({}), makeItem({})];
      const result = getSummaryData(data);
      // Tous les items sans user sont groupés sous une même clé fallback (JSON.stringify(undefined))
      expect(result.totalUsers).toBe(1);
      expect(result.users[0].contributionCount).toBe(2);
      expect(result.users[0].user).toBeNull();
    });
  });

  describe("intégration complète", () => {
    it("combine tous les compteurs sur un dataset réaliste", () => {
      const data = [
        makeItem({
          user: { serverData: { _id: "u1" } },
          voteCount: { like: 5 },
          comments: { c1: {} },
        }),
        makeItem({
          user: { serverData: { _id: "u2" } },
          voteCount: { like: 0 },
        }),
        makeItem({
          user: { serverData: { _id: "u1" } },
          comments: { c1: {}, c2: {} },
        }),
      ];
      const result = getSummaryData(data);
      expect(result).toMatchObject({
        totalAnswers: 3,
        totalUsers: 2,
        totalLikes: 1, // seul u1's premier item a like > 0
        totalComments: 2, // u1's deux items ont des comments
      });
    });
  });
});
