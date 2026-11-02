import { describe, it, expect } from "vitest";
import { isProvided } from "./poiAmenities";

describe("isProvided — valeur réelle, ni vide ni marqueur d'absence", () => {
  it("vrai pour un identifiant ou toute autre valeur saisie", () => {
    expect(isProvided("21974001500017")).toBe(true);
    expect(isProvided("9740001A")).toBe(true);
    // Valeur atypique mais renseignée (relevée en base) : affichée telle quelle.
    expect(isProvided("9741235Z et 9740330R")).toBe(true);
  });

  it("faux pour une valeur absente ou vide", () => {
    expect(isProvided(undefined)).toBe(false);
    expect(isProvided("")).toBe(false);
    expect(isProvided("   ")).toBe(false);
  });

  it("faux pour le marqueur d'absence, quelles qu'en soient la casse, les accents ou le pluriel", () => {
    for (const v of ["Donnée non renseignée", "Données non renseignées", "donnee non renseignee", "  Donnée non renseignée  "]) {
      expect(isProvided(v), v).toBe(false);
    }
  });

  it("vrai pour une valeur qui ne fait que CONTENIR le marqueur", () => {
    expect(isProvided("Donnée non renseignée (à vérifier)")).toBe(true);
  });
});
