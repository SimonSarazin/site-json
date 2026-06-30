import { describe, it, expect } from "vitest";
import type { EntityFormDescriptor } from "@communecter/cocolight-api-client";
import { JsonFormConfigSchema } from "./schema";
import { costumToConfig, type CostumExtensionsArtifact } from "./costumToConfig";

// Réplique simplifiée de costum-extensions.json (cf. alfph/projects).
const ART: CostumExtensionsArtifact = {
  costumExtensions: {
    alfph: {
      projects: {
        fields: [
          { name: "formLocality", path: "formLocality", schema: { type: "string" } },
          { name: "openedAt", path: "openedAt", schema: { type: "string", "x-format": "date" } },
          { name: "theme", path: "theme", multiple: true, enum: ["A", "B"], schema: { oneOf: [{ type: "string" }, { type: "array" }] } },
          { name: "surf", path: "surf", schema: { type: "number" } },
          { name: "secret", path: "secret", schema: { type: "string" } },
        ],
        presets: { mainTag: "ALFPH" },
        hidden: ["secret"],
        add: true,
        createLabel: "Créer le projet",
      },
      ressources: { fields: [], presets: {}, hidden: [], add: true, createLabel: null },
    },
  },
};

describe("costumToConfig", () => {
  const c = costumToConfig(ART, "alfph", "projects")!;

  it("génère une JsonFormConfig VALIDE, scopée costum", () => {
    expect(c).not.toBeNull();
    expect(() => JsonFormConfigSchema.parse(c)).not.toThrow();
    expect(c.entityType).toBe("project");
    expect(c.costum?.slug).toBe("alfph");
    expect(c.title).toBe("alfph");
  });

  it("mappe types → widgets (enum+multiple→multiselect, x-format date→date, number)", () => {
    expect(c.fields.theme).toMatchObject({ type: "array", widget: "multiselect", multiple: true });
    expect(c.fields.theme.enum).toEqual([{ value: "A", label: "A" }, { value: "B", label: "B" }]);
    expect(c.fields.openedAt).toMatchObject({ type: "date", widget: "date" });
    expect(c.fields.surf).toMatchObject({ type: "number", widget: "number" });
    expect(c.fields.formLocality).toMatchObject({ type: "string", widget: "text" });
  });

  it("exclut les champs hidden + reporte presets + createLabel", () => {
    expect(c.fields.secret).toBeUndefined();
    expect(c.sections[0].fields).toEqual(["formLocality", "openedAt", "theme", "surf"]);
    expect(c.submit?.presets).toEqual({ mainTag: "ALFPH" });
    expect(c.submitLabel).toBe("Créer le projet");
  });

  it("retourne null pour une collection non créable ou un costum absent", () => {
    expect(costumToConfig(ART, "alfph", "ressources")).toBeNull();
    expect(costumToConfig(ART, "inconnu", "projects")).toBeNull();
  });
});

// Base curée (descripteur NEUTRE lib `describeEntityForm`) — source des champs de BASE.
const BASE: EntityFormDescriptor = {
  collection: "projects",
  fields: [
    { name: "name", type: "string", multiple: false, label: "Nom du projet", required: true },
    { name: "url", type: "string", multiple: false, label: "Site web", format: "url" },
    { name: "tags", type: "array", multiple: true, label: "Tags" },
    { name: "email", type: "string", multiple: false, label: "Email", format: "email" },
    { name: "formLocality", type: "string", multiple: false, label: "Localité" }, // collision costum → costum gagne
  ],
};

describe("costumToConfig avec base curée (base + costum)", () => {
  const c = costumToConfig(ART, "alfph", "projects", BASE)!;

  it("injecte les champs de base curés, label i18n (catalogue) + widget via format", () => {
    expect(c.fields.name).toMatchObject({ type: "string", widget: "text", required: true });
    expect(c.fields.name.label).toEqual({ fr: "Nom", en: "Name" }); // catalogue l'emporte
    expect(c.fields.url?.widget).toBe("text"); // format url → text
    expect(c.fields.email?.widget).toBe("email"); // format email → widget email
    expect(c.fields.tags?.widget).toBe("tags");
  });

  it("label costum : catalogue si connu, sinon nom humanisé", () => {
    expect(c.fields.formLocality?.label).toEqual({ fr: "Localité", en: "Locality" }); // catalogue
    expect(c.fields.surf?.label).toEqual({ fr: "Surf" }); // hors catalogue → humanisé
    expect(c.fields.openedAt?.label).toEqual({ fr: "Opened at" }); // camelCase → humanisé
  });

  it("laisse le costum gagner sur collision de nom", () => {
    const baseSec = c.sections.find((s) => s.id === "base");
    const costumSec = c.sections.find((s) => s.id === "costum");
    expect(baseSec?.fields).not.toContain("formLocality"); // déclaré côté costum
    expect(costumSec?.fields).toContain("formLocality");
  });

  it("produit 2 sections base + costum, config valide", () => {
    expect(() => JsonFormConfigSchema.parse(c)).not.toThrow();
    expect(c.sections.map((s) => s.id)).toEqual(["base", "costum"]);
    expect(c.sections.find((s) => s.id === "base")!.fields).toContain("name");
    expect(c.fields.secret).toBeUndefined(); // hidden costum toujours exclu
  });
});

// Masquage = `hidden` (legacy dynForm hide), PAS preset. Un preset reste un défaut surchargeable.
describe("costumToConfig : hidden exclut le champ base ; un preset NON", () => {
  const ART_HIDE: CostumExtensionsArtifact = {
    costumExtensions: {
      x: { projects: { fields: [], presets: { tags: ["T"] }, hidden: ["type"], add: true, createLabel: null } },
    },
  };
  const BASE2: EntityFormDescriptor = {
    collection: "projects",
    fields: [
      { name: "name", type: "string", multiple: false },
      { name: "type", type: "string", multiple: false, enum: ["a", "b"] },
      { name: "tags", type: "array", multiple: true },
    ],
  };
  const c = costumToConfig(ART_HIDE, "x", "projects", BASE2)!;

  it("`type` (dans hidden) est retiré du formulaire", () => {
    expect(c.fields.type).toBeUndefined();
    expect(c.sections.find((s) => s.id === "base")!.fields).not.toContain("type");
  });
  it("`tags` (seulement preseté, pas hidden) RESTE éditable (défaut surchargeable)", () => {
    expect(c.fields.tags).toBeDefined();
    expect(c.sections.find((s) => s.id === "base")!.fields).toContain("tags");
    expect(c.submit?.presets).toEqual({ tags: ["T"] }); // preset conservé comme défaut
  });
});
