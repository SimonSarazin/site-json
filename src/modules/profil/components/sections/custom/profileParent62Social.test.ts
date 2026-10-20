import { describe, expect, it } from "vitest";
import { toSocialLinks } from "./profileParent62Social";

describe("toSocialLinks", () => {
  it("lit la forme imbriquée (socialNetwork.<plateforme>)", () => {
    expect(toSocialLinks({ socialNetwork: { facebook: "https://facebook.com/x" } })).toEqual([
      { platform: "facebook", url: "https://facebook.com/x" },
    ]);
  });

  it("lit la forme plate (serverData.<plateforme>), orgs importées/« normales »", () => {
    expect(toSocialLinks({ socialNetwork: {}, instagram: "https://instagram.com/x" })).toEqual([
      { platform: "instagram", url: "https://instagram.com/x" },
    ]);
  });

  it("priorise la forme plate sur l'imbriquée quand les deux existent", () => {
    expect(
      toSocialLinks({
        socialNetwork: { facebook: "https://old.example/facebook" },
        facebook: "https://new.example/facebook",
      }),
    ).toEqual([{ platform: "facebook", url: "https://new.example/facebook" }]);
  });

  it("ignore une valeur vide ou blanche", () => {
    expect(toSocialLinks({ socialNetwork: { facebook: "" }, instagram: "   " })).toEqual([]);
  });

  it("ne retourne que les plateformes renseignées", () => {
    expect(
      toSocialLinks({ socialNetwork: {}, facebook: "https://facebook.com/x", youtube: "https://youtube.com/x" }),
    ).toEqual([
      { platform: "facebook", url: "https://facebook.com/x" },
      { platform: "youtube", url: "https://youtube.com/x" },
    ]);
  });

  it("aucune plateforme renseignée → tableau vide", () => {
    expect(toSocialLinks({ socialNetwork: {} })).toEqual([]);
  });
});
