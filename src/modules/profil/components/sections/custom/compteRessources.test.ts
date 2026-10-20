import { describe, it, expect } from "vitest";

import { compteRessources, type FormulaireAvecReponses } from "./compteRessources";

const FORM = "form-hebergement";
const CHEMIN = "hebergement.places";

/** Réponses telles que `useGetAnswersByFormsQuery` les rend : groupées par formulaire. */
const formulaires = (...valeurs: unknown[]): FormulaireAvecReponses[] => [
  {
    id: FORM,
    answers: valeurs.map((v) => ({ serverData: { answers: { hebergement: { places: v } } } })),
  },
];

describe("compteRessources — ce que l'encart d'une fiche met en avant", () => {
  it("`single` (défaut) additionne la CAPACITÉ saisie, pas les offres", () => {
    // Le bug d'origine : une seule offre d'hébergement déclarant 10 places affichait « 1 ».
    expect(compteRessources({ id: FORM, place: CHEMIN }, formulaires("10"))).toBe(10);
    expect(compteRessources({ id: FORM, place: CHEMIN, type: "single" }, formulaires(4, "6"))).toBe(10);
  });

  it("`answer` compte les OFFRES — le mode qui causait l'affichage à 1", () => {
    expect(compteRessources({ id: FORM, place: CHEMIN, type: "answer" }, formulaires("10"))).toBe(1);
    expect(compteRessources({ id: FORM, place: CHEMIN, type: "answer" }, formulaires("10", "3"))).toBe(2);
  });

  it("`array` somme les longueurs, moins l'en-tête de chaque saisie", () => {
    expect(compteRessources({ id: FORM, place: CHEMIN, type: "array" }, formulaires([["h"], ["a"], ["b"]]))).toBe(2);
    // Un tableau vide ou réduit à son en-tête ne descend pas sous zéro.
    expect(compteRessources({ id: FORM, place: CHEMIN, type: "array" }, formulaires([], [["h"]]))).toBe(0);
  });

  it("ignore ce qui n'est pas un nombre, sans fausser le total", () => {
    expect(compteRessources({ id: FORM, place: CHEMIN }, formulaires("10", "", null, "abc", undefined, 5))).toBe(15);
  });

  it("rend 0 quand la config est incomplète, plutôt qu'un chiffre faux", () => {
    expect(compteRessources(undefined, formulaires("10"))).toBe(0);
    expect(compteRessources({ place: CHEMIN }, formulaires("10"))).toBe(0); // sans id de formulaire
    expect(compteRessources({ id: FORM }, formulaires("10"))).toBe(0); // sans chemin de champ
    expect(compteRessources({ id: "autre-form", place: CHEMIN }, formulaires("10"))).toBe(0);
    expect(compteRessources({ id: FORM, place: CHEMIN }, undefined)).toBe(0);
  });

  it("accepte les alias de chemin encore présents dans les configs", () => {
    expect(compteRessources({ id: FORM, bedRoomPath: CHEMIN }, formulaires("7"))).toBe(7);
    expect(compteRessources({ id: FORM, coworkPath: CHEMIN }, formulaires("7"))).toBe(7);
    expect(compteRessources({ id: FORM, roomPath: CHEMIN }, formulaires("7"))).toBe(7);
  });

  it("`answer` est honoré quelle que soit la ressource (la branche manquait pour les salles)", () => {
    expect(compteRessources({ id: FORM, roomPath: CHEMIN, type: "answer" }, formulaires("x", "y", "z"))).toBe(3);
  });
});
