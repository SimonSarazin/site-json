// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { evaluateRule, useConditionalFields } from "./useConditionalFields";
import type { FieldValues } from "react-hook-form";
import type { ConditionalRule, FormFieldMapping } from "../types";

/**
 * `evaluateRule` — la logique pure d'évaluation des règles conditionnelles
 * (les 6 opérateurs) — et `hasConditionalRule`, qui décide quels champs
 * passent par l'enveloppe animée `ConditionalField`.
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

describe("useConditionalFields — hasConditionalRule", () => {
  function champ(nom: string, cible?: string): FormFieldMapping {
    return {
      name: nom,
      label: nom,
      type: "text",
      componentType: "text",
      isRequired: false,
      ...(cible
        ? {
            conditionalDisplay: {
              enabled: true,
              logic: "and" as const,
              rules: [
                {
                  sourceInput: nom,
                  targetInput: cible,
                  operator: "equals" as const,
                  value: "oui",
                  action: "show" as const,
                },
              ],
            },
          }
        : {}),
    };
  }

  function poser(champs: FormFieldMapping[]) {
    return renderHook(() => {
      // `FieldValues` explicite : le hook attend un `Control<FieldValues>`, et
      // des `defaultValues` littéraux produiraient un `Control` étroit que tsc
      // refuse (invisible pour vitest, qui ne typecheck pas).
      const form = useForm<FieldValues>({ defaultValues: { source: "", cible: "" } });
      return useConditionalFields(champs, form.control);
    }).result.current;
  }

  it("distingue un champ piloté par une règle d'un champ ordinaire", () => {
    // `isFieldVisible` répond « oui » pour l'immense majorité des champs — ceux
    // sans aucune règle. C'est `hasConditionalRule` qui dit si la visibilité
    // peut réellement basculer, donc s'il faut envelopper le champ.
    const { hasConditionalRule } = poser([champ("source", "cible"), champ("cible"), champ("libre")]);
    expect(hasConditionalRule("cible")).toBe(true);
    expect(hasConditionalRule("libre")).toBe(false);
    expect(hasConditionalRule("inconnu")).toBe(false);
  });

  it("un champ sans règle est toujours visible (invariant du call-site)", () => {
    // Les deux fonctions lisent la même table de règles. Les appelants
    // s'appuient dessus : `if (!estConditionnel && !visible) return null` n'est
    // qu'une garde défensive, jamais atteinte tant que cet invariant tient.
    const { hasConditionalRule, isFieldVisible } = poser([
      champ("source", "cible"),
      champ("cible"),
      champ("libre"),
    ]);
    for (const nom of ["libre", "source"]) {
      expect(hasConditionalRule(nom)).toBe(false);
      expect(isFieldVisible(nom)).toBe(true);
    }
  });
});
