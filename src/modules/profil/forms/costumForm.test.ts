import { describe, it, expect } from "vitest";
import type { CostumFormDescriptor } from "@communecter/cocolight-api-client";
import { costumFormConfig, type CostumCapableMe } from "./costumForm";

const desc: CostumFormDescriptor = {
  slug: "lakou", collection: "organizations", costumId: "c", costumType: "organizations",
  add: true, createLabel: "Créer", presets: { mainTag: "X" }, hidden: [],
  fields: [
    { name: "name", path: "name", type: "string", multiple: false, hidden: false },
    { name: "theme", path: "theme", type: "array", multiple: true, enum: ["A", "B"], hidden: false },
    { name: "secret", path: "secret", type: "string", multiple: false, hidden: true },
  ],
};

describe("costumFormConfig (runtime, voie B)", () => {
  it("génère une JsonFormConfig depuis scope.describeForm", async () => {
    const me: CostumCapableMe = { costum: async () => ({ describeForm: () => desc }) };
    const c = (await costumFormConfig(me, "lakou", "organizations"))!;
    expect(c.entityType).toBe("organization");
    expect(c.costum?.slug).toBe("lakou");
    expect(c.fields.theme).toMatchObject({ widget: "multiselect", multiple: true });
    expect(c.fields.theme.enum).toEqual([{ value: "A", label: "A" }, { value: "B", label: "B" }]);
    expect(c.fields.secret).toBeUndefined(); // hidden exclu
    expect(c.submit?.presets).toEqual({ mainTag: "X" });
    expect(c.submitLabel).toBe("Créer");
  });

  it("null si describeForm renvoie null (collection non couverte)", async () => {
    const me: CostumCapableMe = { costum: async () => ({ describeForm: () => null }) };
    expect(await costumFormConfig(me, "lakou", "poi")).toBeNull();
  });
});
