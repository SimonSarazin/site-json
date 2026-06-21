import { describe, it, expect } from "vitest";
import type { JsonFormModalConfig } from "@/types/site-schema";
import { JsonFormConfigSchema } from "@/modules/formEngine";
import { isJsonFormConfig, legacyToJsonFormConfig, toJsonFormConfig } from "./legacyConfig";

// Réplique simplifiée de config.prod.cyber-reunion.json (ancien format).
const LEGACY: JsonFormModalConfig = {
  title: { fr: "Inscrire mon organisation" },
  submitLabel: { fr: "Inscrire" },
  submitMode: "sdk",
  method: "POST",
  entityType: "organization",
  tagsFrom: ["actorType"],
  extraData: { type: "NGO", public: true, costumSlug: "cyberReunion", costumId: "abc", costumType: "organizations" },
  successMessage: { fr: "OK" },
  steps: [
    { title: { fr: "Qui ?" }, fields: [
      { name: "email", label: { fr: "Email" }, type: "email", required: true, validation: "email" },
      { name: "name", label: { fr: "Nom" }, type: "text", required: true },
    ] },
    { title: { fr: "Détails" }, fields: [
      { name: "actorType", label: { fr: "Type" }, type: "multiselect", options: [{ value: "CERT", label: { fr: "CERT" } }] },
      { name: "site", label: { fr: "Site" }, type: "url" },
    ] },
  ],
} as JsonFormModalConfig;

describe("legacyToJsonFormConfig", () => {
  const c = legacyToJsonFormConfig(LEGACY);

  it("produit une config NOUVEAU format valide", () => {
    expect(isJsonFormConfig(c)).toBe(true);
    expect(() => JsonFormConfigSchema.parse(c)).not.toThrow();
  });

  it("mappe entityType + extrait costum.slug depuis extraData", () => {
    expect(c.entityType).toBe("organization");
    expect(c.costum?.slug).toBe("cyberReunion");
  });

  it("steps → sections (wizard), une section par step", () => {
    expect(c.layout.kind).toBe("wizard");
    expect(c.sections.map((s) => s.id)).toEqual(["step0", "step1"]);
    expect(c.sections[0].fields).toEqual(["email", "name"]);
  });

  it("mappe les types legacy → widgets + règles", () => {
    expect(c.fields.email).toMatchObject({ type: "string", widget: "text", required: true, widgetProps: { inputType: "email" } });
    expect(c.fields.email.rules?.regex).toContain("@");
    expect(c.fields.actorType).toMatchObject({ type: "array", widget: "multiselect" });
    expect(c.fields.actorType.enum).toEqual([{ value: "CERT", label: { fr: "CERT" } }]);
    expect(c.fields.site).toMatchObject({ type: "string", widget: "text", widgetProps: { inputType: "url" }, rules: { url: true } });
  });

  it("reporte submit (mode/tagsFrom/extraData/messages) + title", () => {
    expect(c.submit?.mode).toBe("sdk");
    expect(c.submit?.tagsFrom).toEqual(["actorType"]);
    expect(c.submit?.extraData).toMatchObject({ type: "NGO", costumSlug: "cyberReunion" });
    expect(c.title).toEqual({ fr: "Inscrire mon organisation" });
  });

  it("toJsonFormConfig : passe une config nouveau format inchangée", () => {
    expect(toJsonFormConfig(c)).toBe(c);
  });
});
