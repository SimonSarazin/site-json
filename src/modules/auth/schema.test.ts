/**
 * Schéma `auth.register` étendu (docs/33 étape 5) : `mode` + `fields`. Ce que l'on verrouille : la
 * config accepte exactement la grammaire décrite (widgets, options, showIf) et REFUSE une valeur qui
 * n'existe ni côté lib ni côté serveur — un `mode` inconnu serait replié sur `normal` par Node en
 * silence (divergence assumée docs/33), un widget inconnu ne se rendrait pas.
 */
import { describe, it, expect } from "vitest";
import { AuthConfigSchema, RegisterFieldSchema } from "./schema";

const TYPEPRO = {
  name: "typepro",
  label: { fr: "Profession", en: "Profession" },
  widget: "select",
  required: true,
  options: [
    { value: "Médecins", label: { fr: "Médecins", en: "Physicians" } },
    { value: "autres", label: { fr: "Autres à préciser", en: "Other" } },
  ],
};
const OTHERS = {
  name: "othersTypepro",
  label: { fr: "Précisez", en: "Specify" },
  widget: "text",
  required: true,
  showIf: { field: "typepro", equals: "autres" },
};

describe("AuthConfigSchema.register — mode + fields", () => {
  it("accepte le bloc complet (mode single_step_register, select + text conditionnel)", () => {
    const parsed = AuthConfigSchema.safeParse({
      register: { title: { fr: "Créer un compte" }, mode: "single_step_register", fields: [TYPEPRO, OTHERS] },
    });
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.register?.fields?.map((f) => f.name)).toEqual(["typepro", "othersTypepro"]);
  });

  it("reste rétro-compatible : titre/sous-titre seuls, sans mode ni fields", () => {
    expect(AuthConfigSchema.safeParse({ register: { title: { fr: "Créer un compte" } } }).success).toBe(true);
    expect(AuthConfigSchema.safeParse({}).success).toBe(true);
  });

  it("refuse un mode hors {normal, single_step_register}", () => {
    expect(AuthConfigSchema.safeParse({ register: { mode: "auto_validate" } }).success).toBe(false);
  });

  it("refuse un widget inconnu et un champ sans nom", () => {
    expect(RegisterFieldSchema.safeParse({ ...TYPEPRO, widget: "checkbox" }).success).toBe(false);
    expect(RegisterFieldSchema.safeParse({ ...TYPEPRO, name: "" }).success).toBe(false);
  });

  it("refuse un showIf incomplet (field sans equals)", () => {
    expect(RegisterFieldSchema.safeParse({ ...OTHERS, showIf: { field: "typepro" } }).success).toBe(false);
  });

  it("refuse une option sans libellé localisé", () => {
    expect(RegisterFieldSchema.safeParse({ ...TYPEPRO, options: [{ value: "x", label: "x" }] }).success).toBe(false);
  });
});
