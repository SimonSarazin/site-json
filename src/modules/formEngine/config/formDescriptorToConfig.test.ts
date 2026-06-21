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
  sections: [
    { id: "info", label: "Infos", groups: [{ columns: 2, label: "Identité", divider: true, fields: ["name", "type"] }] },
    { id: "loc", fields: ["addr"] },
  ],
  fields: {
    name: { name: "name", type: "string", widget: "text", label: "Nom", required: true, placeholder: "ph", info: "aide", rules: { minLength: 3 }, messages: { required: "Obligatoire" } },
    type: { name: "type", type: "string", widget: "select", label: "Type", enum: [{ value: "NGO", label: "Asso" }], visibleIf: { field: "name", op: "notEmpty" } },
    addr: { name: "addr", type: "object", widget: "location", label: "", read: "identity", write: "toString", widgetProps: { inputType: "email" } },
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
    expect(Object.keys(d2.fields)).toEqual(["name", "type", "addr"]);
    expect(d2.fields.name).toMatchObject({ widget: "text", label: "Nom", required: true, placeholder: "ph", info: "aide", rules: { minLength: 3 }, messages: { required: "Obligatoire" } });
    expect(d2.fields.type.enum).toEqual([{ value: "NGO", label: "Asso" }]);
    expect(d2.fields.type.visibleIf).toEqual({ field: "name", op: "notEmpty" });
    expect(d2.fields.addr).toMatchObject({ widget: "location", read: "identity", write: "toString", widgetProps: { inputType: "email" } });
    expect(d2.sections[0].groups?.[0]).toMatchObject({ columns: 2, label: "Identité", divider: true, fields: ["name", "type"] });
    expect(d2.sections[1].fields).toEqual(["addr"]);
  });
});
