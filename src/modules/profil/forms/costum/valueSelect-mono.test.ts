import { describe, it, expect } from "vitest";
import { compileCostumSchema, type CostumFormSchema } from "./compileCostumSchema";

/**
 * `valueSelect` est MULTI par défaut et stocke alors un tableau. En MONO
 * (`widgetProps.multiple:false`) il stocke une CHAÎNE — c'est la forme des champs scalaires du legacy,
 * que select2 déclare `maximumSelectionLength:1` (ex. `financementSource` d'institutBleu, une chaîne
 * pour les 11 fiches en base).
 *
 * Le schéma compilé doit suivre cette bascule : typé `array` inconditionnellement, il refusait au submit
 * une valeur pourtant correcte — « Invalid input: expected array, received string ».
 */
const schema = (widgetProps?: Record<string, unknown>): CostumFormSchema => ({
  id: "t",
  entityType: "poi",
  collection: "poi",
  layout: { kind: "flat" },
  chrome: { title: { add: "a", edit: "e" } },
  sections: [{ id: "s", groups: [{ fields: ["financeur"] }] }],
  fields: { financeur: { widget: "valueSelect", ...(widgetProps ? { widgetProps } : {}) } },
  mutation: { entityType: "poi" },
} as unknown as CostumFormSchema);

const champ = (s: CostumFormSchema) =>
  compileCostumSchema(s).descriptor.fields.financeur as { type?: string; default?: unknown; read?: string };

describe("valueSelect — type dérivé selon la multiplicité", () => {
  it("mono → chaîne : c'est ce que le widget écrit et ce que le legacy stocke", () => {
    const f = champ(schema({ multiple: false, list: "financeurs" }));
    expect(f.type).toBe("string");
    expect(f.default).toBe("");
  });

  it("multi (défaut) → tableau", () => {
    expect(champ(schema({ list: "territoires" })).type).toBe("array");
    expect(champ(schema()).type).toBe("array");
  });

  it("`multiple:true` explicite reste un tableau", () => {
    expect(champ(schema({ multiple: true })).type).toBe("array");
  });
});

