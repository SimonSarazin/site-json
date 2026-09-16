import { describe, it, expect } from "vitest";
import { vueMembre } from "./ficheMembre";

describe("vueMembre", () => {
  it("rend la donnée de la liste tant que la fiche n'est pas arrivée", () => {
    // C'est ce qui évite un trou dans la grille pendant les requêtes par membre.
    const v = vueMembre({ name: "Ludivine Dupire Fait", slug: "ludivine" }, undefined);
    expect(v.nom).toBe("Ludivine Dupire Fait");
    expect(v.slug).toBe("ludivine");
    expect(v.rattachement).toBeNull();
  });

  it("laisse la FICHE primer champ par champ", () => {
    const v = vueMembre(
      { name: "Ancien nom", slug: "ludivine" },
      { name: "Ludivine DUPIRE FAIT", territoires: "Audomarois" },
    );
    expect(v.nom).toBe("Ludivine DUPIRE FAIT");
    expect(v.slug).toBe("ludivine"); // absent de la fiche → celui de la liste survit
    expect(v.rattachement).toBe("Audomarois");
  });

  it("suit la chaîne de replis de l'avatar, du plus grand au plus petit", () => {
    expect(vueMembre({ profilMediumImageUrl: "m.jpg", profilImageUrl: "g.jpg" }, {}).photo).toBe("m.jpg");
    expect(vueMembre({ profilImageUrl: "g.jpg", profilThumbImageUrl: "p.jpg" }, {}).photo).toBe("g.jpg");
    expect(vueMembre({ profilThumbImageUrl: "p.jpg" }, {}).photo).toBe("p.jpg");
    expect(vueMembre({ profilMediumImageUrl: "  " }, { profilImageUrl: "g.jpg" }).photo).toBe("g.jpg");
  });

  it("n'expose un rattachement que s'il est exploitable", () => {
    // Le même nom de champ porte un TABLEAU sur d'autres collections : le rendre tel quel
    // ferait planter React, et le slugifier n'aurait aucun sens.
    expect(vueMembre({}, { territoires: ["Audomarois"] }).rattachement).toBeNull();
    expect(vueMembre({}, { territoires: "   " }).rattachement).toBeNull();
    expect(vueMembre({}, {}).rattachement).toBeNull();
  });

  it("rend des valeurs sûres quand tout manque", () => {
    const v = vueMembre(undefined, undefined);
    expect(v).toEqual({ nom: "?", slug: null, photo: null, rattachement: null, donnees: {} });
  });

  it("expose la fusion pour les lectures sans champ dédié", () => {
    expect(vueMembre({ a: 1 }, { b: 2 }).donnees).toEqual({ a: 1, b: 2 });
  });
});
