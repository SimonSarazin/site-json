import { describe, expect, it } from "vitest";

import { formatCommuneName, parseCommunesPdfText } from "./parseCommunesPdfText";

/**
 * Fixture calquée sur la sortie réelle de `pdftotext -layout` des PDF
 * « Liste des communes » de parent62.org : page de titre + 2 pages de données
 * en 3 colonnes, avec les deux formes de continuation observées (tiret final
 * type « BAILLEUL-SIRE- / BERTHOULT » et retour à la ligne sans tiret type
 * « SAINT POL SUR / TERNOISE »).
 */
const FIXTURE = [
  // --- page de titre (à ignorer : le nom du territoire n'est pas une commune)
  [
    "Parent62 - Liste des communes sur les territoires                        1 oct. 2020",
    "",
    "                                                     TERRITOIRE",
    "                                                      ARRAGEOIS",
    "",
    "        Listes des communes sur le territoire",
    "",
  ].join("\n"),
  // --- page de données 1
  [
    "Parent62 - Liste des communes sur les territoires                             1 oct. 2020",
    "",
    "",
    "ARRAS                                      BELLONNE                       BOISLEUX-SAINT-MARC",
    "",
    "",
    "BAILLEUL-SIRE-                             BERTENCOURT-LE-                ŒUF EN TERNOIS",
    "BERTHOULT                                  CAUROY",
    "",
    "ATHIES                                     CAMBLAIN L’ABBE                SAINT POL SUR",
    "                                                                          TERNOISE",
    "",
    "Réseau Parentalité 62 - Liste des communes sur le territoire: Arrageois   1 oct. 2020   1",
  ].join("\n"),
  // --- page de données 2 (casse mixte + doublon volontaire d'ARRAS +
  //     entrées numérotées façon PDF Artois)
  [
    "Parent62 - Liste des communes sur les territoires                             1 oct. 2020",
    "",
    "Noyelles-godault                           ARRAS",
    "",
    "",
    "12. Lillers                                27. Calonne-sur-la-Lys",
    "",
    "   2",
  ].join("\n"),
  // --- page vide finale (artefact pdftotext)
  "",
].join("\f");

describe("parseCommunesPdfText", () => {
  it("extrait, normalise, déduplique et trie les communes des pages de données", () => {
    expect(parseCommunesPdfText(FIXTURE)).toEqual([
      "Arras",
      "Athies",
      "Bailleul-Sire-Berthoult",
      "Bellonne",
      "Bertencourt-le-Cauroy",
      "Boisleux-Saint-Marc",
      "Calonne-sur-la-Lys",
      "Camblain l’Abbe",
      "Lillers",
      "Noyelles-Godault",
      "Œuf en Ternois",
      "Saint Pol sur Ternoise",
    ]);
  });

  it("retire la numérotation d'énumération (format du PDF Artois)", () => {
    const parsed = parseCommunesPdfText(FIXTURE);
    expect(parsed).toContain("Lillers");
    expect(parsed).not.toContain("12. Lillers");
  });

  it("ignore la page de titre : le nom du territoire n'est pas pris pour une commune", () => {
    const parsed = parseCommunesPdfText(FIXTURE);
    expect(parsed).not.toContain("Arrageois");
    expect(parsed).not.toContain("Territoire");
  });

  it("recolle les noms coupés : avec tiret sans espace, sans tiret avec espace", () => {
    const parsed = parseCommunesPdfText(FIXTURE);
    expect(parsed).toContain("Bailleul-Sire-Berthoult");
    expect(parsed).toContain("Saint Pol sur Ternoise");
    expect(parsed).not.toContain("Berthoult");
    expect(parsed).not.toContain("Ternoise");
  });
});

describe("formatCommuneName", () => {
  it("capitalise chaque mot et garde les particules en minuscule", () => {
    expect(formatCommuneName("SAINT POL SUR TERNOISE")).toBe("Saint Pol sur Ternoise");
    expect(formatCommuneName("ŒUF EN TERNOIS")).toBe("Œuf en Ternois");
    expect(formatCommuneName("AGNEZ-LÈS-DUISANS")).toBe("Agnez-lès-Duisans");
  });

  it("gère les apostrophes (l', d') sans toucher à la graphie publiée", () => {
    expect(formatCommuneName("CAMBLAIN L’ABBE")).toBe("Camblain l’Abbe");
    expect(formatCommuneName("VILLERS L’HOPITAL")).toBe("Villers l’Hopital");
  });

  it("capitalise une particule en tête de nom", () => {
    expect(formatCommuneName("LE PORTEL")).toBe("Le Portel");
  });

  it("normalise la casse mixte des PDF capitalisés", () => {
    expect(formatCommuneName("Noyelles-godault")).toBe("Noyelles-Godault");
    expect(formatCommuneName("Bénifontaine")).toBe("Bénifontaine");
  });
});
