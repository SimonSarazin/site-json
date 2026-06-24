import { describe, it, expect } from "vitest";
import type { JsonFormConfig } from "@/modules/formEngine";
import { buildConfigDefaults, isPipelineConfig } from "./jsonFormSubmit";

const baseConfig: JsonFormConfig = {
  id: "t", entityType: "organization", costum: { slug: "cyberReunion" },
  layout: { kind: "flat" }, sections: [],
  fields: {
    name: { type: "string", widget: "text", label: { fr: "Nom" } },
    actorType: { type: "array", widget: "multiselect", label: { fr: "Type" } },
    logo: { type: "object", widget: "location", label: { fr: "Adresse" } },
  },
};

describe("isPipelineConfig (gate)", () => {
  it("config sans serializeGroups ni read/write → NON-pipeline", () => {
    expect(isPipelineConfig(baseConfig)).toBe(false);
  });
  it("config avec un champ read OU write → pipeline", () => {
    expect(isPipelineConfig({ ...baseConfig, fields: { ...baseConfig.fields, name: { ...baseConfig.fields.name, read: "pf:orEmpty" } } })).toBe(true);
  });
  it("config avec serializeGroups → pipeline", () => {
    expect(isPipelineConfig({ ...baseConfig, serializeGroups: { address: { serverKey: "address", read: "r", write: "w" } } })).toBe(true);
  });
});

describe("buildConfigDefaults", () => {
  it("défaut par type + amorce les champs adresse si widget location", () => {
    const d = buildConfigDefaults(baseConfig);
    expect(d.name).toBe("");
    expect(d.actorType).toEqual([]);
    expect(d.addressCountry).toBe("");
    expect(d.localityId).toBe("");
  });
});
