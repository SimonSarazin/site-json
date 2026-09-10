import { describe, it, expect } from "vitest";
import { resolveAnswerAuthorId } from "./answerAuthor";

/**
 * Régression : le déposant d'un commun ne voyait pas son bouton « Modifier »,
 * seul un admin l'avait. La comparaison d'auteur portait sur `answer.user` —
 * que `FindAnsweredByIdAction` écrase par l'ORGANISATION porteuse quand la
 * réponse a un `links.organizations`, ce qui est le cas courant d'un AAC.
 */
describe("resolveAnswerAuthorId", () => {
  const AUTEUR = "55f053fbe41d75cd64558518";
  const ORGA = "677e7e13bd08b2478f5f5314";

  it("préfère `userId` à `user` quand `user` a été remplacé par l'organisation", () => {
    expect(
      resolveAnswerAuthorId({
        userId: AUTEUR,
        user: { _id: ORGA, name: "Fédération des CAE" },
      })
    ).toBe(AUTEUR);
  });

  it("ne rend JAMAIS l'id de l'organisation — le cœur du bug", () => {
    const resolu = resolveAnswerAuthorId({
      userId: AUTEUR,
      user: { _id: ORGA, name: "Fédération des CAE" },
    });
    expect(resolu).not.toBe(ORGA);
  });

  it("retombe sur `user` en chaîne quand `userId` est absent", () => {
    expect(resolveAnswerAuthorId({ user: AUTEUR })).toBe(AUTEUR);
  });

  it("retombe sur `user._id` quand rien d'autre n'est disponible", () => {
    expect(resolveAnswerAuthorId({ user: { _id: AUTEUR } })).toBe(AUTEUR);
  });

  it("ignore un `userId` vide plutôt que de rendre une chaîne vide", () => {
    // Le backend pose `userId = $answer["user"] ?? ""` : la chaîne vide est sa
    // façon de dire « pas d'auteur » (compte temporaire). La laisser passer
    // ferait matcher un `currentUserId` lui aussi vide.
    expect(resolveAnswerAuthorId({ userId: "", user: { _id: AUTEUR } })).toBe(AUTEUR);
    expect(resolveAnswerAuthorId({ userId: "   " })).toBeUndefined();
  });

  it("rend undefined sur une réponse sans auteur identifiable", () => {
    expect(resolveAnswerAuthorId({})).toBeUndefined();
    expect(resolveAnswerAuthorId(null)).toBeUndefined();
    expect(resolveAnswerAuthorId({ user: {} })).toBeUndefined();
  });
});
