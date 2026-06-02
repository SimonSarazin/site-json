import { describe, expect, it } from "vitest";
import { evaluateRule } from "./useConditionalFields";
import type { ConditionalRule } from "../types";

/**
 * Tests unitaires pour `evaluateRule` — la logique pure d'évaluation des règles
 * conditionnelles. Couvre les 6 opérateurs supportés.
 *
 * Le hook `useConditionalFields` lui-même utilise `useWatch` (React Hook Form)
 * et serait à tester via `@testing-library/react-hooks` avec un mock — hors scope
 * de ces tests unitaires purs.
 */

function makeRule(operator: ConditionalRule["operator"], value: string): ConditionalRule {
  return {
    sourceInput: "src",
    targetInput: "tgt",
    operator,
    value,
    action: "show",
  };
}

describe("evaluateRule", () => {
  describe("equals", () => {
    it("retourne true quand la valeur match", () => {
      expect(evaluateRule(makeRule("equals", "yes"), "yes")).toBe(true);
    });

    it("retourne false quand la valeur diffère", () => {
      expect(evaluateRule(makeRule("equals", "yes"), "no")).toBe(false);
    });

    it("coerce les non-strings (number → string)", () => {
      expect(evaluateRule(makeRule("equals", "42"), 42)).toBe(true);
    });

    it("traite null/undefined comme chaîne vide", () => {
      expect(evaluateRule(makeRule("equals", ""), null)).toBe(true);
      expect(evaluateRule(makeRule("equals", ""), undefined)).toBe(true);
    });
  });

  describe("notEquals", () => {
    it("retourne true quand la valeur diffère", () => {
      expect(evaluateRule(makeRule("notEquals", "yes"), "no")).toBe(true);
    });

    it("retourne false quand la valeur match", () => {
      expect(evaluateRule(makeRule("notEquals", "yes"), "yes")).toBe(false);
    });
  });

  describe("contains", () => {
    it("retourne true quand la chaîne contient le pattern", () => {
      expect(evaluateRule(makeRule("contains", "ll"), "hello")).toBe(true);
    });

    it("retourne false quand la chaîne ne contient pas le pattern", () => {
      expect(evaluateRule(makeRule("contains", "xyz"), "hello")).toBe(false);
    });

    it("retourne true pour chaîne vide cherchée", () => {
      // "".includes("") === true
      expect(evaluateRule(makeRule("contains", ""), "hello")).toBe(true);
    });
  });

  describe("matches (regex)", () => {
    it("retourne true quand la regex match", () => {
      expect(evaluateRule(makeRule("matches", "^[a-z]+$"), "hello")).toBe(true);
    });

    it("retourne false quand la regex ne match pas", () => {
      expect(evaluateRule(makeRule("matches", "^[0-9]+$"), "hello")).toBe(false);
    });

    it("retourne false silencieusement pour regex invalide (au lieu de throw)", () => {
      expect(evaluateRule(makeRule("matches", "[invalid"), "hello")).toBe(false);
    });
  });

  describe("isEmpty", () => {
    it("retourne true pour chaîne vide", () => {
      expect(evaluateRule(makeRule("isEmpty", ""), "")).toBe(true);
    });

    it("retourne true pour null/undefined", () => {
      expect(evaluateRule(makeRule("isEmpty", ""), null)).toBe(true);
      expect(evaluateRule(makeRule("isEmpty", ""), undefined)).toBe(true);
    });

    it("retourne true pour tableau vide", () => {
      expect(evaluateRule(makeRule("isEmpty", ""), [])).toBe(true);
    });

    it("retourne false pour chaîne non vide", () => {
      expect(evaluateRule(makeRule("isEmpty", ""), "hello")).toBe(false);
    });

    it("retourne false pour tableau non vide", () => {
      // Note: les arrays sont sérialisés en chaînes via String() — ["a"] → "a", donc non vide.
      expect(evaluateRule(makeRule("isEmpty", ""), ["a"])).toBe(false);
    });
  });

  describe("isNotEmpty", () => {
    it("retourne true pour chaîne non vide", () => {
      expect(evaluateRule(makeRule("isNotEmpty", ""), "hello")).toBe(true);
    });

    it("retourne false pour chaîne vide", () => {
      expect(evaluateRule(makeRule("isNotEmpty", ""), "")).toBe(false);
    });

    it("retourne false pour null/undefined", () => {
      expect(evaluateRule(makeRule("isNotEmpty", ""), null)).toBe(false);
      expect(evaluateRule(makeRule("isNotEmpty", ""), undefined)).toBe(false);
    });

    it("retourne false pour tableau vide", () => {
      expect(evaluateRule(makeRule("isNotEmpty", ""), [])).toBe(false);
    });
  });

  describe("opérateur inconnu (default)", () => {
    it("retourne false pour un opérateur non supporté", () => {
      const rule = { ...makeRule("equals", ""), operator: "unknown" as never };
      expect(evaluateRule(rule, "anything")).toBe(false);
    });
  });
});
