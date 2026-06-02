import { describe, expect, it } from "vitest";
import {
  convertBootstrapWidth,
  extractMongoId,
  formatTimestamp,
  generateFieldId,
  isStepComplete,
  mergeStepsData,
} from "./helpers";

/**
 * Tests unitaires pour `utils/helpers.ts` — 6 pure functions utilitaires
 * partagées entre les composants CoForm.
 */

describe("convertBootstrapWidth", () => {
  it("retourne w-full pour undefined ou vide", () => {
    expect(convertBootstrapWidth(undefined)).toBe("w-full");
    expect(convertBootstrapWidth("")).toBe("w-full");
  });

  it("mappe les classes Bootstrap connues vers Tailwind", () => {
    expect(convertBootstrapWidth("col-lg-12 col-md-12 col-xs-12")).toBe("w-full");
    expect(convertBootstrapWidth("col-lg-6 col-md-6 col-xs-12")).toBe("w-full md:w-1/2");
    expect(convertBootstrapWidth("col-lg-4 col-md-4 col-xs-12")).toBe("w-full md:w-1/3");
    expect(convertBootstrapWidth("col-lg-3 col-md-3 col-xs-12")).toBe("w-full md:w-1/4");
    expect(convertBootstrapWidth("col-lg-8 col-md-8 col-xs-12")).toBe("w-full md:w-2/3");
    expect(convertBootstrapWidth("col-lg-9 col-md-9 col-xs-12")).toBe("w-full md:w-3/4");
  });

  it("retourne w-full pour une classe Bootstrap inconnue", () => {
    expect(convertBootstrapWidth("col-lg-2 col-md-2")).toBe("w-full");
    expect(convertBootstrapWidth("random-class")).toBe("w-full");
  });
});

describe("generateFieldId", () => {
  it("concatène subFormId et fieldKey avec underscore", () => {
    expect(generateFieldId("step1", "name")).toBe("step1_name");
    expect(generateFieldId("abc123", "field-xyz")).toBe("abc123_field-xyz");
  });

  it("préserve les chaînes vides", () => {
    expect(generateFieldId("", "")).toBe("_");
    expect(generateFieldId("step1", "")).toBe("step1_");
    expect(generateFieldId("", "field")).toBe("_field");
  });
});

describe("extractMongoId", () => {
  it("retourne la chaîne telle quelle si déjà string", () => {
    expect(extractMongoId("64a1b2c3d4e5f6789")).toBe("64a1b2c3d4e5f6789");
  });

  it("extrait $id depuis un objet { $id }", () => {
    expect(extractMongoId({ $id: "64a1b2c3d4e5f6789" })).toBe("64a1b2c3d4e5f6789");
  });

  it("préserve les caractères dans $id", () => {
    expect(extractMongoId({ $id: "custom-id-with-dashes" })).toBe("custom-id-with-dashes");
  });
});

describe("formatTimestamp", () => {
  it("convertit un timestamp Unix (secondes) en date locale", () => {
    // 2026-01-01 00:00:00 UTC = 1767225600 secondes
    const result = formatTimestamp(1767225600);
    // On vérifie juste que ça produit une string non vide et parsable
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
    // La date doit contenir 2026 (ou 2025 selon timezone)
    expect(result).toMatch(/202[56]/);
  });

  it("retourne une string pour timestamp 0 (epoch)", () => {
    const result = formatTimestamp(0);
    expect(typeof result).toBe("string");
    expect(result).toMatch(/19(69|70)/); // 1969 ou 1970 selon TZ
  });
});

describe("isStepComplete", () => {
  it("retourne true si aucun champ requis", () => {
    expect(isStepComplete({}, [])).toBe(true);
    expect(isStepComplete({ x: "value" }, [])).toBe(true);
  });

  it("retourne true si tous les champs requis sont remplis", () => {
    expect(
      isStepComplete({ name: "Alice", email: "a@b.com" }, ["name", "email"]),
    ).toBe(true);
  });

  it("retourne false si un champ requis est absent", () => {
    expect(isStepComplete({ name: "Alice" }, ["name", "email"])).toBe(false);
  });

  it("retourne false si un champ requis est chaîne vide", () => {
    expect(isStepComplete({ name: "" }, ["name"])).toBe(false);
  });

  it("retourne false si un champ requis est null ou undefined", () => {
    expect(isStepComplete({ name: null as never }, ["name"])).toBe(false);
    expect(isStepComplete({ name: undefined as never }, ["name"])).toBe(false);
  });

  it("retourne true pour un array non vide", () => {
    expect(isStepComplete({ tags: ["a", "b"] }, ["tags"])).toBe(true);
  });

  it("retourne false pour un array vide", () => {
    expect(isStepComplete({ tags: [] }, ["tags"])).toBe(false);
  });

  it("retourne true pour un nombre 0 (valeur scalaire valide)", () => {
    // 0 n'est ni undefined, ni null, ni ""
    expect(isStepComplete({ count: 0 }, ["count"])).toBe(true);
  });

  it("retourne true pour false (valeur scalaire valide)", () => {
    expect(isStepComplete({ accepted: false }, ["accepted"])).toBe(true);
  });
});

describe("mergeStepsData", () => {
  it("retourne objet vide pour aucune étape", () => {
    expect(mergeStepsData({})).toEqual({});
  });

  it("fusionne les données d'une seule étape", () => {
    expect(mergeStepsData({ step1: { name: "Alice", age: 30 } })).toEqual({
      name: "Alice",
      age: 30,
    });
  });

  it("fusionne plusieurs étapes en un objet plat", () => {
    expect(
      mergeStepsData({
        step1: { name: "Alice" },
        step2: { email: "a@b.com", age: 30 },
      }),
    ).toEqual({
      name: "Alice",
      email: "a@b.com",
      age: 30,
    });
  });

  it("les étapes suivantes écrasent les clés en collision", () => {
    expect(
      mergeStepsData({
        step1: { name: "Alice" },
        step2: { name: "Bob" },
      }),
    ).toEqual({ name: "Bob" });
  });

  it("ignore les étapes vides", () => {
    expect(
      mergeStepsData({
        step1: {},
        step2: { name: "Alice" },
        step3: {},
      }),
    ).toEqual({ name: "Alice" });
  });
});
