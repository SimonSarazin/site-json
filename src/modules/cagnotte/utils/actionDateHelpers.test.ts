import { describe, expect, it } from "vitest";
import {
  frenchDateToPickerValue,
  parseFrenchDateToIso,
  pickerValueToFrenchDate,
  timestampToFrenchDate,
} from "./actionDateHelpers";

/**
 * Convertit une ISO UTC retournée par `parseFrenchDateToIso` en triplet `[Y, M, D]`
 * exprimé dans la timezone **locale** où le test s'exécute. Évite la fragilité aux TZ :
 * `parseFrenchDateToIso("31/12/2024")` retourne `2024-12-30T23:00:00.000Z` à Paris,
 * mais le triplet local reste `[2024, 12, 31]`.
 */
function localDateParts(iso: string | null): [number, number, number] | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return [d.getFullYear(), d.getMonth() + 1, d.getDate()];
}

describe("parseFrenchDateToIso", () => {
  it("parse une date FR valide (jour/mois/année reflètent l'input en local)", () => {
    expect(localDateParts(parseFrenchDateToIso("31/12/2024"))).toEqual([2024, 12, 31]);
    expect(localDateParts(parseFrenchDateToIso("01/01/2000"))).toEqual([2000, 1, 1]);
    expect(localDateParts(parseFrenchDateToIso("29/02/2024"))).toEqual([2024, 2, 29]); // bissextile
  });

  it("retourne null pour une chaîne vide ou whitespace", () => {
    expect(parseFrenchDateToIso("")).toBeNull();
    expect(parseFrenchDateToIso("   ")).toBeNull();
  });

  it("retourne null pour une date invalide", () => {
    expect(parseFrenchDateToIso("32/12/2024")).toBeNull(); // jour invalide
    expect(parseFrenchDateToIso("01/13/2024")).toBeNull(); // mois invalide
    expect(parseFrenchDateToIso("29/02/2023")).toBeNull(); // pas bissextile
  });

  it("retourne null pour un format invalide", () => {
    expect(parseFrenchDateToIso("2024-12-31")).toBeNull();
    expect(parseFrenchDateToIso("31-12-2024")).toBeNull();
    expect(parseFrenchDateToIso("not a date")).toBeNull();
  });
});

describe("frenchDateToPickerValue", () => {
  it('convertit "31/12/2024" → "2024-12-31"', () => {
    expect(frenchDateToPickerValue("31/12/2024")).toBe("2024-12-31");
  });

  it('retourne "" pour une chaîne vide', () => {
    expect(frenchDateToPickerValue("")).toBe("");
    expect(frenchDateToPickerValue("  ")).toBe("");
  });

  it('retourne "" pour un format invalide', () => {
    expect(frenchDateToPickerValue("32/12/2024")).toBe("");
    expect(frenchDateToPickerValue("invalid")).toBe("");
  });
});

describe("pickerValueToFrenchDate", () => {
  it('convertit "2024-12-31" → "31/12/2024"', () => {
    expect(pickerValueToFrenchDate("2024-12-31")).toBe("31/12/2024");
  });

  it('retourne "" pour une chaîne vide', () => {
    expect(pickerValueToFrenchDate("")).toBe("");
  });

  it("aller-retour FR ↔ picker préserve la date", () => {
    const fr = "15/06/2025";
    const picker = frenchDateToPickerValue(fr);
    expect(pickerValueToFrenchDate(picker)).toBe(fr);
  });
});

describe("timestampToFrenchDate", () => {
  it("convertit un timestamp ms en DD/MM/YYYY", () => {
    // 2024-12-31T12:00:00 UTC = 1735646400000ms
    const result = timestampToFrenchDate(1735646400000);
    // L'heure du jour peut varier selon TZ mais la date doit matcher.
    expect(result).toMatch(/^\d{2}\/\d{2}\/2024$/);
  });

  it('retourne "" pour undefined/null/0', () => {
    expect(timestampToFrenchDate(undefined)).toBe("");
    expect(timestampToFrenchDate(null)).toBe("");
    expect(timestampToFrenchDate(0)).toBe("");
  });

  it('retourne "" pour un timestamp invalide (NaN)', () => {
    expect(timestampToFrenchDate(NaN)).toBe("");
  });
});
