import { describe, expect, it } from "vitest";
import { getDashboardStats } from "./dashboardStats";
import type { AmpliDataResponse } from "../types";

/**
 * `Answer` (entité SDK) a ~170 membres ; les agrégations ne lisent que
 * `serverData` — d'où le cast structurel via `unknown` (même parti pris que
 * `helpers/summary.test.ts`).
 */
type ServerDataLike = {
  /** Présent sur la donnée revivifiée par le SDK ; prioritaire sur `_id`. */
  id?: string;
  _id?: unknown;
  user?: { serverData: { _id: string; name?: string } };
  vote?: Record<string, unknown>;
  voteCount?: { like?: number };
  comments?: Record<string, unknown>;
};

function makeItem(
  serverData: ServerDataLike,
  data: Record<string, unknown> = {},
  user?: AmpliDataResponse["user"],
): AmpliDataResponse {
  return {
    answer: { serverData } as unknown as AmpliDataResponse["answer"],
    data,
    user,
  };
}

describe("getDashboardStats", () => {
  it("retourne des compteurs vides pour un périmètre vide", () => {
    expect(getDashboardStats([])).toEqual({
      participants: 0,
      comments: 0,
      likes: 0,
      tagsUsed: 0,
      tags: [],
      topLiked: [],
      topCommented: [],
    });
  });

  it("compte les participants uniques", () => {
    const alice = { serverData: { _id: "u1", name: "Alice" } };
    const stats = getDashboardStats([
      makeItem({ user: alice }),
      makeItem({ user: alice }),
      makeItem({ user: { serverData: { _id: "u2", name: "Bob" } } }),
    ]);
    expect(stats.participants).toBe(2);
  });

  // Différence assumée avec `getSummaryData` (qui compte les RÉPONSES aimées) :
  // le tableau de bord annonce « appréciations reçues », donc un total.
  it("totalise les likes et les commentaires, pas les réponses concernées", () => {
    const stats = getDashboardStats([
      makeItem({ voteCount: { like: 3 }, comments: { c1: {}, c2: {} } }),
      makeItem({ voteCount: { like: 2 } }),
    ]);
    expect(stats.likes).toBe(5);
    expect(stats.comments).toBe(2);
  });

  it("retombe sur les entrées de `vote` quand `voteCount.like` est absent", () => {
    const stats = getDashboardStats([makeItem({ vote: { u1: {}, u2: {} } })]);
    expect(stats.likes).toBe(2);
  });

  it("agrège les tags et les trie par usage décroissant", () => {
    const stats = getDashboardStats([
      makeItem({}, { tags: ["climat", "mobilité"] }),
      makeItem({}, { tags: ["climat"] }),
      // Tag unique non tableau (champ coform mono-valeur) et espaces parasites.
      makeItem({}, { tags: " climat " }),
    ]);
    expect(stats.tags).toEqual([
      { name: "climat", value: 3 },
      { name: "mobilité", value: 1 },
    ]);
    expect(stats.tagsUsed).toBe(2);
  });

  it("ignore les réponses sans tag", () => {
    const stats = getDashboardStats([makeItem({}), makeItem({}, { tags: [] })]);
    expect(stats.tagsUsed).toBe(0);
  });

  it("classe les tops par décompte décroissant et exclut les zéros", () => {
    const stats = getDashboardStats([
      makeItem({ _id: "a1", voteCount: { like: 1 } }, { name: "Idée A" }, { name: "Alice" }),
      makeItem({ _id: "a2", voteCount: { like: 4 }, comments: { c1: {} } }, { name: "Idée B" }, { name: "Bob" }),
      makeItem({ _id: "a3" }, { name: "Idée C" }),
    ]);

    expect(stats.topLiked).toEqual([
      { id: "a2", name: "Idée B", author: "Bob", count: 4 },
      { id: "a1", name: "Idée A", author: "Alice", count: 1 },
    ]);
    expect(stats.topCommented).toEqual([{ id: "a2", name: "Idée B", author: "Bob", count: 1 }]);
  });

  it("borne les classements à la limite demandée", () => {
    const data = Array.from({ length: 8 }, (_, i) =>
      makeItem({ _id: `a${i}`, voteCount: { like: i + 1 } }, { name: `Idée ${i}` }),
    );
    expect(getDashboardStats(data).topLiked).toHaveLength(5);
    expect(getDashboardStats(data, 2).topLiked.map((entry) => entry.count)).toEqual([8, 7]);
  });

  it("lit l'auteur depuis l'entité User quand `includeUserInfo` n'a pas été activé", () => {
    const stats = getDashboardStats([
      makeItem({ _id: "a1", user: { serverData: { _id: "u1", name: "Alice" } }, voteCount: { like: 1 } }),
    ]);
    expect(stats.topLiked[0].author).toBe("Alice");
  });

  // Au runtime `_id` arrive en OBJET Mongo : ne lire qu'une chaîne rendait `""`
  // pour TOUTES les réponses, et les classements retombaient sur l'index comme
  // clé React. Mêmes trois formes que `contributorId`.
  it("déplie un `_id` objet Mongo, dans ses trois formes", () => {
    const like = { voteCount: { like: 1 } };
    expect(getDashboardStats([makeItem({ _id: { $id: "x1" }, ...like })]).topLiked[0].id).toBe("x1");
    expect(getDashboardStats([makeItem({ _id: { _str: "x2" }, ...like })]).topLiked[0].id).toBe("x2");
    expect(getDashboardStats([makeItem({ id: "x3", _id: { $id: "autre" }, ...like })]).topLiked[0].id).toBe("x3");
  });

  it("tolère un `_id` vraiment illisible et un nom manquant", () => {
    const stats = getDashboardStats([makeItem({ _id: { nope: 1 }, voteCount: { like: 1 } })]);
    expect(stats.topLiked[0]).toEqual({ id: "", name: "", author: "", count: 1 });
  });
});
