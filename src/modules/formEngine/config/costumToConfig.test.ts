import { describe, it, expect } from "vitest";
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
