import { describe, it, expect } from "vitest";
import { cheminTerritoire, couleursTerritoire, memeTerritoire } from "./teamDirectory";

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
      expect(cheminTerritoire(libelle), libelle).toBe(chemin);
    }
  });

  it("tolère les espaces superflus et la casse", () => {
    expect(cheminTerritoire("  AUDOMAROIS  ")).toBe("/territoire/audomarois");
  });

  it("rend null quand il n'y a rien à lier", () => {
    expect(cheminTerritoire(null)).toBeNull();
    expect(cheminTerritoire(undefined)).toBeNull();
    expect(cheminTerritoire("")).toBeNull();
    expect(cheminTerritoire("   ")).toBeNull();
    expect(cheminTerritoire("!!!")).toBeNull();
  });
});

describe("memeTerritoire", () => {
  it("apparie deux écritures du même territoire", () => {
    expect(memeTerritoire("Audomarois", "audomarois")).toBe(true);
    expect(memeTerritoire("Familles en sol mineur Hénin Carvin", "Familles en sol mineur Henin-Carvin")).toBe(true);
    expect(memeTerritoire("  Entre Mer et Terres ", "entre mer et terres")).toBe(true);
  });

  it("distingue deux territoires différents", () => {
    expect(memeTerritoire("Artois", "Arrageois")).toBe(false);
    expect(memeTerritoire("Familles en sol mineur Lens Liévin", "Familles en sol mineur Hénin Carvin")).toBe(false);
  });

  it("ne rapproche jamais deux valeurs vides", () => {
    // Sans ce garde-fou, un profil sans territoire tomberait dans TOUTES les pages territoire.
    expect(memeTerritoire(null, null)).toBe(false);
    expect(memeTerritoire("", "")).toBe(false);
    expect(memeTerritoire(undefined, "Artois")).toBe(false);
    expect(memeTerritoire("Artois", null)).toBe(false);
  });
});

describe("couleursTerritoire", () => {
  it("indexe les variables sur le slug de page, pas sur le libellé", () => {
    expect(couleursTerritoire("Audomarois")).toEqual({
      fond: "var(--territoire-audomarois-carte, var(--card))",
      encre: "var(--territoire-audomarois-encre, var(--card-foreground))",
      bordure: "var(--territoire-audomarois-carte, var(--border))",
    });
    // Le nom long, et non l'abrégé `fsm-` des variables de marque.
    expect(couleursTerritoire("Familles en sol mineur Hénin Carvin").fond).toBe(
      "var(--territoire-familles-en-sol-mineur-henin-carvin-carte, var(--card))",
    );
  });

  it("retombe sur une carte neutre quand le territoire est absent", () => {
    // Sans ce repli, une carte sans territoire serait TRANSPARENTE, pas neutre.
    const neutre = { fond: "var(--card)", encre: "var(--card-foreground)", bordure: "var(--border)" };
    expect(couleursTerritoire(null)).toEqual(neutre);
    expect(couleursTerritoire("  ")).toEqual(neutre);
  });
});

describe("convention de rattachement surchargeable", () => {
  // Le module `profil` est générique : un autre site doit pouvoir brancher ses propres gabarits
  // sans toucher au code. Sans ce test, le `/territoire/` de parent62 pourrait se re-figer en dur.
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

  it("retombe sur la convention parent62 quand rien n'est fourni", () => {
    expect(cheminTerritoire("Artois")).toBe("/territoire/artois");
    expect(couleursTerritoire("Artois").fond).toBe("var(--territoire-artois-carte, var(--card))");
  });
});
