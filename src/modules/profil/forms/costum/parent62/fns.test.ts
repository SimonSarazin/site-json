import { describe, it, expect } from "vitest";
import { selectNewValues } from "./fns";

describe("selectNewValues", () => {
  it("valeur mono inédite → retenue", () => {
    expect(selectNewValues("Compliqué", [])).toEqual(["Compliqué"]);
  });

  it("valeur mono déjà connue (casse/accents près) → écartée", () => {
    expect(selectNewValues("compliqué", ["Compliqué"])).toEqual([]);
    expect(selectNewValues("COMPLIQUÉ", ["Compliqué"])).toEqual([]);
  });

  it("tableau (multi) : inédites retenues, connues écartées", () => {
    expect(selectNewValues(["La santé", "Le deuil"], ["La santé"])).toEqual(["Le deuil"]);
  });

  it("dédoublonne ENTRE les valeurs soumises (même valeur 2x dans le même envoi)", () => {
    expect(selectNewValues(["Le deuil", "le deuil", "Autre"], [])).toEqual(["Le deuil", "Autre"]);
  });

  it("ignore les chaînes vides/blanches — mono", () => {
    expect(selectNewValues("", [])).toEqual([]);
    expect(selectNewValues("   ", [])).toEqual([]);
  });

  it("ignore les chaînes vides/blanches — multi (slot vidé dans un multi-select)", () => {
    expect(selectNewValues(["Le deuil", "", "  "], [])).toEqual(["Le deuil"]);
  });

  it("valeurs non-string dans le tableau → ignorées sans planter", () => {
    expect(selectNewValues(["Le deuil", 42, null, undefined], [])).toEqual(["Le deuil"]);
  });

  it("soumis null/undefined/nombre → aucune candidate", () => {
    expect(selectNewValues(null, [])).toEqual([]);
    expect(selectNewValues(undefined, [])).toEqual([]);
    expect(selectNewValues(42, [])).toEqual([]);
  });

  it("connues vide + soumis vide → []", () => {
    expect(selectNewValues([], [])).toEqual([]);
  });
});
