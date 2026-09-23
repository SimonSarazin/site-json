import { describe, it, expect } from "vitest";
import { vueMembre } from "./ficheMembre";

describe("vueMembre", () => {
  it("lit nom, slug et rattachement sur la donnée de la liste projetée", () => {
    // La liste porte `territoires` dès que la section le projette (`fields`) : une seule source.
    const v = vueMembre({ name: "Ludivine Dupire Fait", slug: "ludivine", territoires: "Audomarois" });
    expect(v.nom).toBe("Ludivine Dupire Fait");
    expect(v.slug).toBe("ludivine");
    expect(v.rattachement).toBe("Audomarois");
  });

  it("suit la chaîne de replis de l'avatar, du plus grand au plus petit", () => {
    expect(vueMembre({ profilMediumImageUrl: "m.jpg", profilImageUrl: "g.jpg" }).photo).toBe("m.jpg");
    expect(vueMembre({ profilImageUrl: "g.jpg", profilThumbImageUrl: "p.jpg" }).photo).toBe("g.jpg");
    expect(vueMembre({ profilThumbImageUrl: "p.jpg" }).photo).toBe("p.jpg");
    expect(vueMembre({ profilMediumImageUrl: "  ", profilImageUrl: "g.jpg" }).photo).toBe("g.jpg");
  });

  it("lit aussi un rattachement porté en TABLEAU — ce que l'égalité Mongo du filtre apparie", () => {
    // `{ territoires: "Audomarois" }` côté serveur retient un doc `["Audomarois"]` : la carte doit
    // le voir, sinon un coordonnateur filtré s'afficherait sans libellé, couleur ni lien.
    expect(vueMembre({ territoires: ["Audomarois"] }).rattachement).toBe("Audomarois");
    expect(vueMembre({ territoires: ["  ", "Artois"] }).rattachement).toBe("Artois");
  });

  it("n'expose rien quand aucun libellé n'est exploitable", () => {
    expect(vueMembre({ territoires: "   " }).rattachement).toBeNull();
    expect(vueMembre({ territoires: [] }).rattachement).toBeNull();
    expect(vueMembre({ territoires: [42] }).rattachement).toBeNull();
    expect(vueMembre({}).rattachement).toBeNull();
  });

  it("rend des valeurs sûres quand tout manque", () => {
    expect(vueMembre(undefined)).toEqual({ nom: "?", slug: null, photo: null, rattachement: null, donnees: {} });
  });

  it("expose la donnée brute pour les lectures sans champ dédié", () => {
    expect(vueMembre({ a: 1, telephone: "06" }).donnees).toEqual({ a: 1, telephone: "06" });
  });
});
