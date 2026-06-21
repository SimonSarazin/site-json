import { describe, it, expect } from "vitest";
import type { LocalizedString } from "@/types/locale-schema";
import { JsonFormConfigSchema, type JsonFormConfig } from "./schema";
import { configToDescriptor, defaultWidgetForType, INPUT_TYPE_TO_WIDGET } from "./configToDescriptor";

const tLoc = (l: LocalizedString) => l.fr ?? "";

const FIXTURE: JsonFormConfig = {
  id: "demo",
  entityType: "organization",
  costum: { slug: "monCostum" },
  layout: { kind: "tabs" },
  i18n: "localized",
  sections: [
    { id: "basic", label: { fr: "Infos", en: "Info" }, groups: [
      { columns: 2, label: { fr: "Identité" }, divider: true, titleClassName: "text-sm font-semibold", fields: ["name", "type"] },
    ] },
    { id: "contact", label: { fr: "Contact" }, fields: ["email", "raw"] },
  ],
  fields: {
    name: { type: "string", widget: "text", label: { fr: "Nom", en: "Name" }, required: true, placeholder: { fr: "Votre nom" }, info: { fr: "aide" } },
    type: { type: "string", widget: "select", label: { fr: "Type" }, enum: [
      { value: "NGO", label: { fr: "Association", en: "NGO" } },
      { value: "Group", label: { fr: "Groupe" } },
    ] },
    email: { type: "string", widget: "text", label: { fr: "Email" }, widgetProps: { inputType: "email" },
      rules: { regex: "^[^@]+@[^@]+$" }, visibleIf: { field: "name", op: "notEmpty" } },
    raw: { type: "string", widget: "text", label: "ProfileEdit.fields.url.label" }, // clé i18n (string) → pass-through
  },
};

describe("JsonFormConfigSchema", () => {
  it("valide une config complète", () => {
    expect(() => JsonFormConfigSchema.parse(FIXTURE)).not.toThrow();
  });

  it("rejette une config sans entityType valide", () => {
    expect(() => JsonFormConfigSchema.parse({ ...FIXTURE, entityType: "alien" })).toThrow();
  });

  it("rejette un label localisé sans fr (langue par défaut requise)", () => {
    const bad = { ...FIXTURE, fields: { ...FIXTURE.fields, name: { ...FIXTURE.fields.name, label: { en: "Name" } } } };
    expect(() => JsonFormConfigSchema.parse(bad)).toThrow();
  });
});

describe("configToDescriptor", () => {
  const d = configToDescriptor(FIXTURE, { tLoc });

  it("dérive collection depuis entityType + reporte costumSlug + layout", () => {
    expect(d.collection).toBe("organizations");
    expect(d.costumSlug).toBe("monCostum");
    expect(d.layout).toEqual({ kind: "tabs" });
    expect(d.id).toBe("demo");
  });

  it("pré-résout les libellés localisés (fr) et passe les clés string telles quelles", () => {
    expect(d.fields.name.label).toBe("Nom");
    expect(d.fields.name.placeholder).toBe("Votre nom");
    expect(d.fields.name.info).toBe("aide");
    expect(d.fields.raw.label).toBe("ProfileEdit.fields.url.label"); // string → inchangé
  });

  it("résout les libellés d'options enum", () => {
    expect(d.fields.type.enum).toEqual([
      { value: "NGO", label: "Association" },
      { value: "Group", label: "Groupe" },
    ]);
  });

  it("reporte required, rules, visibleIf, widgetProps tels quels", () => {
    expect(d.fields.name.required).toBe(true);
    expect(d.fields.email.rules).toEqual({ regex: "^[^@]+@[^@]+$" });
    expect(d.fields.email.visibleIf).toEqual({ field: "name", op: "notEmpty" });
    expect(d.fields.email.widgetProps).toEqual({ inputType: "email" });
  });

  it("mappe sections + groupes (colonnes/divider/titleClassName/labels)", () => {
    expect(d.sections.map((s) => s.id)).toEqual(["basic", "contact"]);
    expect(d.sections[0].label).toBe("Infos");
    expect(d.sections[0].groups?.[0]).toMatchObject({ columns: 2, label: "Identité", divider: true, titleClassName: "text-sm font-semibold", fields: ["name", "type"] });
    expect(d.sections[1].fields).toEqual(["email", "raw"]);
  });

  it("ne pose pas de validate en P0 (câblé en P1)", () => {
    expect(d.validate).toBeUndefined();
  });

  it("pré-résout les messages de validation (LocalizedString) par règle", () => {
    const cfg: JsonFormConfig = {
      id: "m", entityType: "poi", layout: { kind: "flat" }, sections: [],
      fields: { code: { type: "string", widget: "text", label: { fr: "Code" }, required: true,
        rules: { regex: "^[A-Z]+$" }, messages: { required: { fr: "Obligatoire", en: "Required" }, format: { fr: "Format invalide" } } } },
    };
    const dd = configToDescriptor(cfg, { tLoc });
    expect(dd.fields.code.messages).toEqual({ required: "Obligatoire", format: "Format invalide" });
  });
});

describe("helpers", () => {
  it("defaultWidgetForType", () => {
    expect(defaultWidgetForType("string")).toBe("text");
    expect(defaultWidgetForType("string", false, true)).toBe("select");
    expect(defaultWidgetForType("string", true, true)).toBe("multiselect");
    expect(defaultWidgetForType("boolean")).toBe("switch");
    expect(defaultWidgetForType("date")).toBe("date");
    expect(defaultWidgetForType("array")).toBe("tags");
  });

  it("INPUT_TYPE_TO_WIDGET couvre les inputs dynForm/coform clés", () => {
    expect(INPUT_TYPE_TO_WIDGET.finder).toBe("finder");
    expect(INPUT_TYPE_TO_WIDGET.formLocality).toBe("location");
    expect(INPUT_TYPE_TO_WIDGET.uploader).toBe("image");
  });
});
