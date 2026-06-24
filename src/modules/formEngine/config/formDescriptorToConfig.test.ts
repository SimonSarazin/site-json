import { describe, it, expect } from "vitest";
import type { FormDescriptor } from "../types";
import { JsonFormConfigSchema } from "./schema";
import { formDescriptorToConfig } from "./formDescriptorToConfig";
import { configToDescriptor } from "./configToDescriptor";

const desc: FormDescriptor = {
  id: "rt",
  collection: "organizations",
  costumSlug: "demo",
  layout: { kind: "tabs" },
  validate: "addressValid", // CLÉ de registre (string) → sérialisable
  // Groupes de sérialisation (N champs plats ↔ 1 objet serveur) — read/write = clés de registre.
  serializeGroups: {
    address: { serverKey: "address", read: "pf:addressRead", write: "pf:addressWrite" },
    social: { serverKey: "socialNetwork", read: "pf:socialRead", write: "coerce:orEmpty", groupReadOnly: true },
  },
  sections: [
    { id: "info", label: "Infos", groups: [{ columns: 2, label: "Identité", divider: true, fields: ["name", "type"] }] },
    { id: "loc", fields: ["addr", "addressCountry", "github", "geo", "public"] },
  ],
  fields: {
    name: { name: "name", type: "string", widget: "text", label: "Nom", required: true, placeholder: "ph", info: "aide", rules: { minLength: 3 }, messages: { required: "Obligatoire" } },
    type: { name: "type", type: "string", widget: "select", label: "Type", enum: [{ value: "NGO", label: "Asso" }], visibleIf: { field: "name", op: "notEmpty" } },
    addr: { name: "addr", type: "object", widget: "location", label: "", read: "identity", write: "toString", widgetProps: { inputType: "email" } },
    // membre d'un groupe de sérialisation (adresse) + clear typé
    addressCountry: { name: "addressCountry", type: "string", widget: "hidden", label: "addressCountry", group: "address", clear: "" },
    // membre d'un groupe groupReadOnly (social, écrit à plat)
    github: { name: "github", type: "string", widget: "hidden", label: "github", group: "social", write: "coerce:orEmpty" },
    // WRITE-only (posé par EditLocationTab, jamais relu)
    geo: { name: "geo", type: "object", widget: "hidden", label: "geo", writeOnly: true, write: "geo:write" },
    // READ-only (seedé, jamais émis)
    public: { name: "public", type: "boolean", widget: "hidden", label: "public", readOnly: true, read: "pf:rdPublic" },
  },
};

describe("formDescriptorToConfig (sens inverse + bidirectionnalité)", () => {
  const config = formDescriptorToConfig(desc);

  it("produit une JsonFormConfig VALIDE", () => {
    expect(() => JsonFormConfigSchema.parse(config)).not.toThrow();
    expect(config.entityType).toBe("organization");
    expect(config.collection).toBe("organizations");
    expect(config.costum?.slug).toBe("demo");
    expect(config.validateFn).toBe("addressValid");
    expect(config.i18n).toBe("keys");
  });

  it("round-trip descriptor → config → descriptor préserve la structure", () => {
    const d2 = configToDescriptor(config, { tLoc: (l) => l.fr ?? "" });
    expect(d2.collection).toBe(desc.collection);
    expect(d2.costumSlug).toBe(desc.costumSlug);
    expect(d2.layout).toEqual(desc.layout);
    expect(d2.validate).toBe("addressValid");
    expect(Object.keys(d2.fields)).toEqual(["name", "type", "addr", "addressCountry", "github", "geo", "public"]);
    expect(d2.fields.name).toMatchObject({ widget: "text", label: "Nom", required: true, placeholder: "ph", info: "aide", rules: { minLength: 3 }, messages: { required: "Obligatoire" } });
    expect(d2.fields.type.enum).toEqual([{ value: "NGO", label: "Asso" }]);
    expect(d2.fields.type.visibleIf).toEqual({ field: "name", op: "notEmpty" });
    expect(d2.fields.addr).toMatchObject({ widget: "location", read: "identity", write: "toString", widgetProps: { inputType: "email" } });
    expect(d2.sections[0].groups?.[0]).toMatchObject({ columns: 2, label: "Identité", divider: true, fields: ["name", "type"] });
    expect(d2.sections[1].fields).toEqual(["addr", "addressCountry", "github", "geo", "public"]);
  });

  it("round-trip préserve le PIPELINE : serializeGroups + group/writeOnly/readOnly/clear", () => {
    // config (sérialisée) doit porter les groupes + les flags par champ
    expect(config.serializeGroups).toEqual(desc.serializeGroups);
    expect(config.fields.addressCountry).toMatchObject({ group: "address", clear: "" });
    expect(config.fields.github).toMatchObject({ group: "social", write: "coerce:orEmpty" });
    expect(config.fields.geo).toMatchObject({ writeOnly: true, write: "geo:write" });
    expect(config.fields.public).toMatchObject({ readOnly: true, read: "pf:rdPublic" });

    // config → descriptor : tout revient à l'identique
    const d2 = configToDescriptor(config, { tLoc: (l) => l.fr ?? "" });
    expect(d2.serializeGroups).toEqual(desc.serializeGroups);
    expect(d2.fields.addressCountry).toMatchObject({ group: "address", clear: "" });
    expect(d2.fields.github).toMatchObject({ group: "social" });
    expect(d2.fields.geo).toMatchObject({ writeOnly: true });
    expect(d2.fields.public).toMatchObject({ readOnly: true });
  });
});
