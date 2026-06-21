import { describe, it, expect } from "vitest";
import type { JsonFormConfig } from "@/modules/formEngine";
import { buildGenericPayload, buildConfigDefaults, runSubmit, type MeLike, type SubmitTarget } from "./jsonFormSubmit";

const baseConfig: JsonFormConfig = {
  id: "t", entityType: "organization", costum: { slug: "cyberReunion" },
  layout: { kind: "flat" }, sections: [],
  fields: {
    name: { type: "string", widget: "text", label: { fr: "Nom" } },
    actorType: { type: "array", widget: "multiselect", label: { fr: "Type" } },
    logo: { type: "object", widget: "location", label: { fr: "Adresse" } },
  },
  submit: {
    mode: "sdk",
    tagsFrom: ["actorType"],
    extraData: { type: "NGO", public: true, costumSlug: "cyberReunion", costumId: "x", costumType: "organizations" },
    presets: { role: "admin" },
  },
};

describe("buildGenericPayload", () => {
  it("agrège tagsFrom dans tags + fusionne extraData (sans les clés costum*)", () => {
    const p = buildGenericPayload(baseConfig, { name: "Org", actorType: ["CERT", "Formation"] });
    expect(p.name).toBe("Org");
    expect(p.tags).toEqual(["CERT", "Formation"]);
    expect(p.type).toBe("NGO");
    expect(p.public).toBe(true);
    expect(p).not.toHaveProperty("costumSlug");
    expect(p).not.toHaveProperty("costumId");
    expect(p).not.toHaveProperty("costumType");
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

describe("runSubmit", () => {
  it("route via me.costum(slug).organization(payload) + save (presets AVANT data)", async () => {
    const rec: { costumSlug?: string; method?: string; payload?: Record<string, unknown>; saved?: boolean } = {};
    const scope: SubmitTarget = {
      organization: async (payload) => { rec.method = "organization"; rec.payload = payload; return { save: async () => { rec.saved = true; }, slug: "org-new" }; },
      project: async () => ({ save: async () => {} }),
      event: async () => ({ save: async () => {} }),
      poi: async () => ({ save: async () => {} }),
    };
    const me: MeLike = { ...scope, costum: async (slug) => { rec.costumSlug = slug; return scope; } };

    const out = await runSubmit(baseConfig, { name: "Org", actorType: ["CERT"] }, { me, parent: null });

    expect(rec.costumSlug).toBe("cyberReunion");
    expect(rec.method).toBe("organization");
    expect(rec.saved).toBe(true);
    expect(out.slug).toBe("org-new");
    expect(rec.payload?.name).toBe("Org");
    expect(rec.payload?.tags).toEqual(["CERT"]);
    expect(rec.payload?.role).toBe("admin"); // preset
    expect(rec.payload?.type).toBe("NGO");    // extraData
  });

  it("sans costum : route via parent ?? me", async () => {
    const rec: { method?: string } = {};
    const target: SubmitTarget = {
      organization: async () => { rec.method = "organization"; return { save: async () => {} }; },
      project: async () => ({ save: async () => {} }),
      event: async () => ({ save: async () => {} }),
      poi: async () => ({ save: async () => {} }),
    };
    const me: MeLike = { ...target, costum: async () => target };
    const cfg: JsonFormConfig = { ...baseConfig, costum: undefined };
    await runSubmit(cfg, { name: "X" }, { me, parent: target });
    expect(rec.method).toBe("organization");
  });
});
