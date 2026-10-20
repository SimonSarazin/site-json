import { describe, it, expect } from "vitest";
import { cheminTerritoire, couleursTerritoire, exigerConvention } from "./teamDirectory";

// La convention vient de la config : le module n'en code aucune. Celle-ci est celle de parent62.
const territoire = { cheminGabarit: "/territoire/{slug}", prefixeCouleur: "--territoire" };

describe("cheminTerritoire", () => {
  it("retrouve les 9 pages territoire de parent62 à partir du libellé de profil", () => {
    // Couples relevés dans la config : titre de page ⇄ chemin réel.
    const attendu: Record<string, string> = {
      "Arrageois": "/territoire/arrageois",
      "Artois": "/territoire/artois",
      "Audomarois": "/territoire/audomarois",
      "Boulonnais": "/territoire/boulonnais",
      "Calaisis": "/territoire/calaisis",
      "Entre Mer et Terres": "/territoire/entre-mer-et-terres",
      "Familles en sol mineur Hénin Carvin": "/territoire/familles-en-sol-mineur-henin-carvin",
      "Familles en sol mineur Lens Liévin": "/territoire/familles-en-sol-mineur-lens-lievin",
      "Ternois Bruaysis": "/territoire/ternois-bruaysis",
    };
    for (const [libelle, chemin] of Object.entries(attendu)) {
      expect(cheminTerritoire(libelle, territoire), libelle).toBe(chemin);
    }
  });

  it("retire les diacritiques par échappements \\u, pas par caractères combinants bruts", () => {
    // Une normalisation NFC du fichier source ne doit rien pouvoir casser ici.
    expect(cheminTerritoire("Hénin-Carvin", territoire)).toBe("/territoire/henin-carvin");
    expect(cheminTerritoire("Liévin Éàü", territoire)).toBe("/territoire/lievin-eau");
  });

  it("tolère les espaces superflus et la casse", () => {
    expect(cheminTerritoire("  AUDOMAROIS  ", territoire)).toBe("/territoire/audomarois");
  });

  it("rend null quand il n'y a rien à lier", () => {
    expect(cheminTerritoire(null, territoire)).toBeNull();
    expect(cheminTerritoire(undefined, territoire)).toBeNull();
    expect(cheminTerritoire("", territoire)).toBeNull();
    expect(cheminTerritoire("   ", territoire)).toBeNull();
    expect(cheminTerritoire("!!!", territoire)).toBeNull();
  });
});

describe("couleursTerritoire", () => {
  it("indexe les variables sur le slug de page, pas sur le libellé", () => {
    expect(couleursTerritoire("Audomarois", territoire)).toEqual({
      fond: "var(--territoire-audomarois-carte, var(--card))",
      encre: "var(--territoire-audomarois-encre, var(--card-foreground))",
      bordure: "var(--territoire-audomarois-carte, var(--border))",
    });
    // Le nom long, et non l'abrégé `fsm-` des variables de marque.
    expect(couleursTerritoire("Familles en sol mineur Hénin Carvin", territoire).fond).toBe(
      "var(--territoire-familles-en-sol-mineur-henin-carvin-carte, var(--card))",
    );
  });

  it("retombe sur une carte neutre quand le territoire est absent", () => {
    // Sans ce repli, une carte sans territoire serait TRANSPARENTE, pas neutre.
    const neutre = { fond: "var(--card)", encre: "var(--card-foreground)", bordure: "var(--border)" };
    expect(couleursTerritoire(null, territoire)).toEqual(neutre);
    expect(couleursTerritoire("  ", territoire)).toEqual(neutre);
  });
});

describe("convention de rattachement fournie par la config", () => {
  // Le module `profil` est générique : un autre site branche ses propres gabarits sans toucher au
  // code — et parent62 n'est pas un repli caché dans le moteur.
  const region = { cheminGabarit: "/region/{slug}", prefixeCouleur: "--region" };

  it("suit le gabarit de chemin fourni", () => {
    expect(cheminTerritoire("Hauts-de-France", region)).toBe("/region/hauts-de-france");
  });

  it("suit le préfixe de variables fourni", () => {
    expect(couleursTerritoire("Hauts-de-France", region)).toEqual({
      fond: "var(--region-hauts-de-france-carte, var(--card))",
      encre: "var(--region-hauts-de-france-encre, var(--card-foreground))",
      bordure: "var(--region-hauts-de-france-carte, var(--border))",
    });
  });
});

describe("exigerConvention", () => {
  it("rend la convention telle quelle quand elle est complète", () => {
    expect(exigerConvention(territoire)).toBe(territoire);
  });

  it("échoue tôt, avec le nom de la clé de config, quand elle manque ou est incomplète", () => {
    // Une carte « équipe » sans convention rendrait sans lien ni couleur, sans que rien ne le dise.
    const message = /member\.card\.rattachement/;
    expect(() => exigerConvention(undefined)).toThrow(message);
    expect(() => exigerConvention({ cheminGabarit: "/x/{slug}" } as never)).toThrow(message);
    expect(() => exigerConvention({ prefixeCouleur: "--x" } as never)).toThrow(message);
    // Même contrat que le préflight : sans `{slug}` toutes les cartes iraient sur la même page.
    expect(() => exigerConvention({ cheminGabarit: "/territoire", prefixeCouleur: "--territoire" })).toThrow(message);
    expect(() => exigerConvention({ cheminGabarit: "/x/{slug}", prefixeCouleur: "territoire" })).toThrow(message);
  });
});
