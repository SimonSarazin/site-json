import { describe, expect, it } from "vitest";
import { groupVotersByReaction, toVotersData, votersSummary } from "./voters";

/** La forme exacte mesurée sur le backend (sonde J6). */
const REAL_RESPONSE = {
  _id: "abc",
  voteCount: { like: 2, love: 1 },
  vote: {
    "63771a2a2129551c8f4fd9c3": {
      status: "like",
      date: "2026-09-23T18:13:54.000Z",
      _id: { _str: "63771a2a2129551c8f4fd9c3" },
      name: "Raya Saly Vanellope",
      slug: "raya",
      profilThumbImageUrl: "http://exemple.test/thumb.png",
      id: "63771a2a2129551c8f4fd9c3",
    },
    "55f053fbe41d75cd64558518": {
      status: "love",
      date: "2026-09-22T09:00:00.000Z",
      name: "Camille",
      slug: "camille",
      id: "55f053fbe41d75cd64558518",
    },
  },
};

describe("toVotersData", () => {
  it("lit la forme réelle du serveur, avatars et noms compris", () => {
    const { voters } = toVotersData(REAL_RESPONSE);
    expect(voters).toHaveLength(2);
    // L'entrée porte déjà le nom et l'avatar : aucun appel supplémentaire n'est nécessaire.
    expect(voters[0]).toMatchObject({
      name: "Raya Saly Vanellope",
      slug: "raya",
      avatarUrl: "http://exemple.test/thumb.png",
      reaction: "like",
    });
  });

  it("classe du plus récent au plus ancien", () => {
    const { voters } = toVotersData(REAL_RESPONSE);
    expect(voters.map(v => v.name)).toEqual(["Raya Saly Vanellope", "Camille"]);
  });

  it("garde les compteurs du serveur, en écartant les zéros", () => {
    const { counts } = toVotersData({ ...REAL_RESPONSE, voteCount: { like: 2, love: 1, sad: 0 } });
    expect(counts).toEqual({ like: 2, love: 1 });
  });

  it("accepte un compteur rendu en chaîne — le legacy en stocke", () => {
    const { counts } = toVotersData({ voteCount: { like: "3" }, vote: {} });
    expect(counts).toEqual({ like: 3 });
  });

  it("ignore une entrée sans statut plutôt que d'afficher un votant vide", () => {
    const { voters } = toVotersData({ vote: { u1: { name: "Sans statut" } } });
    expect(voters).toHaveLength(0);
  });

  it("retombe sur la clé quand l'entrée n'a pas d'`id`", () => {
    const { voters } = toVotersData({ vote: { "clef-utilisateur": { status: "like" } } });
    expect(voters[0]?.id).toBe("clef-utilisateur");
  });

  it("ne casse pas sur une réponse vide ou absurde", () => {
    for (const input of [null, undefined, {}, [], "erreur", { vote: null }]) {
      expect(toVotersData(input)).toEqual({ voters: [], counts: {} });
    }
  });
});

describe("groupVotersByReaction", () => {
  it("range chaque votant sous sa réaction", () => {
    const { voters } = toVotersData(REAL_RESPONSE);
    const grouped = groupVotersByReaction(voters);
    expect(grouped.get("like")).toHaveLength(1);
    expect(grouped.get("love")).toHaveLength(1);
    expect(grouped.get("sad")).toBeUndefined();
  });
});

describe("votersSummary", () => {
  const many = Array.from({ length: 5 }, (_, i) => ({
    id: String(i), name: `Personne ${i}`, slug: null, avatarUrl: null, reaction: "like", at: i,
  }));

  it("nomme les premiers et compte les autres", () => {
    expect(votersSummary(many, 3)).toEqual({
      names: "Personne 0, Personne 1, Personne 2",
      others: 2,
    });
  });

  it("ne compte personne en trop quand la liste est courte", () => {
    expect(votersSummary(many.slice(0, 2), 3)).toEqual({ names: "Personne 0, Personne 1", others: 0 });
  });

  it("ignore les votants sans nom plutôt que d'afficher des virgules vides", () => {
    const withAnonymous = [...many.slice(0, 2), { ...many[0]!, id: "x", name: "" }];
    expect(votersSummary(withAnonymous, 3).names).toBe("Personne 0, Personne 1");
  });
});
