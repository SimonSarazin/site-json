import { describe, it, expect } from "vitest";
import { buildZodSchema } from "./zodGen";
import { registerValidate } from "./transforms";
import type { FormDescriptor } from "../types";

const base: FormDescriptor = {
  id: "t", collection: "citoyens", layout: { kind: "flat" }, sections: [],
  fields: { name: { name: "name", type: "string", widget: "text", label: "Nom" } },
};

describe("FormDescriptor.validate string|fn (registre)", () => {
  registerValidate("test:nameReq", (v) => (v.name ? [] : [{ path: "name", message: "req" }]));

  it("résout une CLÉ de registre", () => {
    const schema = buildZodSchema({ ...base, validate: "test:nameReq" });
    expect(schema.safeParse({ name: "x" }).success).toBe(true);
    const bad = schema.safeParse({ name: "" });
    expect(bad.success).toBe(false);
    if (!bad.success) expect(bad.error.issues.some((i) => i.path[0] === "name" && i.message === "req")).toBe(true);
  });

  it("accepte toujours une FONCTION inline (non-régression descripteurs TS)", () => {
    const schema = buildZodSchema({ ...base, validate: (v) => (v.name ? [] : [{ path: "name", message: "r2" }]) });
    expect(schema.safeParse({ name: "" }).success).toBe(false);
  });

  it("clé inconnue = no-op (pas d'erreur)", () => {
    expect(buildZodSchema({ ...base, validate: "test:nope" }).safeParse({ name: "" }).success).toBe(true);
  });
});

describe("rules par champ (zodGen)", () => {
  const mk = (rules: Record<string, unknown>): ReturnType<typeof buildZodSchema> =>
    buildZodSchema({ id: "r", collection: "citoyens", layout: { kind: "flat" }, sections: [], fields: { f: { name: "f", type: "string", widget: "text", label: "F", rules } } });

  it("regex", () => {
    const s = mk({ regex: "^[A-Z]+$" });
    expect(s.safeParse({ f: "AB" }).success).toBe(true);
    expect(s.safeParse({ f: "ab" }).success).toBe(false);
  });
  it("minLength / maxLength", () => {
    const s = mk({ minLength: 2, maxLength: 4 });
    expect(s.safeParse({ f: "abc" }).success).toBe(true);
    expect(s.safeParse({ f: "a" }).success).toBe(false);
    expect(s.safeParse({ f: "abcde" }).success).toBe(false);
  });
  it("min / max (number)", () => {
    const s = buildZodSchema({ id: "r", collection: "citoyens", layout: { kind: "flat" }, sections: [], fields: { n: { name: "n", type: "number", widget: "number", label: "N", rules: { min: 1, max: 10 } } } });
    expect(s.safeParse({ n: 5 }).success).toBe(true);
    expect(s.safeParse({ n: 0 }).success).toBe(false);
    expect(s.safeParse({ n: 11 }).success).toBe(false);
  });
  it("champ vide NON requis → aucune règle appliquée", () => {
    expect(mk({ regex: "^[A-Z]+$" }).safeParse({ f: "" }).success).toBe(true);
  });

  // Sur un TABLEAU, min/max portent sur le NOMBRE d'éléments (`maximumSelectionLength` legacy) —
  // avant, `Number(["a","b"])` valait NaN et la règle ne se déclenchait jamais.
  describe("min / max sur un TABLEAU = nombre d'éléments", () => {
    const arr = (rules: Record<string, unknown>) =>
      buildZodSchema({
        id: "r", collection: "citoyens", layout: { kind: "flat" }, sections: [],
        fields: { cats: { name: "cats", type: "array", widget: "multiselect", label: "Cats", multiple: true, rules } },
      });

    it("max : au-delà du plafond → invalide", () => {
      const s = arr({ max: 2 });
      expect(s.safeParse({ cats: ["a", "b"] }).success).toBe(true);
      expect(s.safeParse({ cats: ["a"] }).success).toBe(true);
      const bad = s.safeParse({ cats: ["a", "b", "c"] });
      expect(bad.success).toBe(false);
      if (!bad.success) expect(bad.error.issues[0].message).toBe("validation.maxItems");
    });

    it("min : en dessous du plancher → invalide", () => {
      const bad = arr({ min: 2 }).safeParse({ cats: ["a"] });
      expect(bad.success).toBe(false);
      if (!bad.success) expect(bad.error.issues[0].message).toBe("validation.minItems");
    });

    it("tableau vide non requis → aucune règle appliquée", () => {
      expect(arr({ min: 2, max: 2 }).safeParse({ cats: [] }).success).toBe(true);
    });

    it("les nombres gardent les messages min/max scalaires (non-régression)", () => {
      const s = buildZodSchema({
        id: "r", collection: "citoyens", layout: { kind: "flat" }, sections: [],
        fields: { n: { name: "n", type: "number", widget: "number", label: "N", rules: { max: 2 } } },
      });
      const bad = s.safeParse({ n: 3 });
      expect(bad.success).toBe(false);
      if (!bad.success) expect(bad.error.issues[0].message).toBe("validation.max");
    });
  });
});

describe("field.messages (message custom par règle)", () => {
  it("utilise le message custom au lieu de la clé i18n par défaut", () => {
    const d: FormDescriptor = {
      ...base,
      fields: { name: { name: "name", type: "string", widget: "text", label: "Nom", required: true, messages: { required: "Obligatoire !" } } },
    };
    const r = buildZodSchema(d).safeParse({ name: "" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toBe("Obligatoire !");
  });

  it("retombe sur la clé i18n par défaut sans message custom", () => {
    const d: FormDescriptor = {
      ...base,
      fields: { name: { name: "name", type: "string", widget: "text", label: "Nom", required: true } },
    };
    const r = buildZodSchema(d).safeParse({ name: "" });
    if (!r.success) expect(r.error.issues[0].message).toBe("validation.required");
  });
});
