import { describe, it, expect } from "vitest";
import { CostumFormSchemaZod } from "./costumFormSchema.zod";

/**
 * `duplicateCheck` se désarme en SILENCE quand il est incohérent : un champ qui n'existe pas rend
 * `undefined`, un slot jamais ancré ne s'affiche pas, et rien ne le signale en production. Le zod
 * est le seul endroit où l'erreur peut être dite à l'auteur de la config.
 */
const doc = (over: Record<string, unknown> = {}) => ({
  id: "lieu",
  entityType: "organizations",
  layout: { kind: "wizard" },
  fields: { name: { widget: "text" }, postalCode: { widget: "hidden" } },
  sections: [{ id: "info", groups: [{ columns: 1, fields: ["name", "$slot:duplicates"] }] }],
  chrome: { title: { add: "Créer", edit: "Modifier" } },
  mutation: { entityType: "organizations" },
  slots: { duplicates: "slot:entityDuplicates" },
  duplicateCheck: { nameField: "name", postalCodeField: "postalCode", confirmOnSubmit: true, search: { types: ["organizations"], filters: { tags: "X" } } },
  ...over,
});
const issues = (value: unknown) => {
  const r = CostumFormSchemaZod.safeParse(value);
  return r.success ? [] : r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
};

describe("CostumFormSchemaZod — duplicateCheck", () => {
  it("accepte un bloc cohérent, et un document sans bloc", () => {
    expect(issues(doc())).toEqual([]);
    expect(issues(doc({ duplicateCheck: undefined, slots: undefined, sections: [{ id: "info", fields: ["name"] }] }))).toEqual([]);
  });

  it("refuse une clé mal orthographiée (strict) et un type de recherche inconnu", () => {
    expect(issues(doc({ duplicateCheck: { nameField: "name", confirmOnSumbit: true, search: { types: ["organizations"] } } })).join()).toContain("duplicateCheck");
    expect(issues(doc({ duplicateCheck: { nameField: "name", search: { types: ["tierslieux"] } } })).join()).toContain("duplicateCheck.search.types");
  });

  it("refuse un champ de référence qui n'est pas déclaré dans fields", () => {
    const base = doc().duplicateCheck;
    expect(issues(doc({ duplicateCheck: { ...base, nameField: "nom" } })).join()).toContain("duplicateCheck.nameField");
    expect(issues(doc({ duplicateCheck: { ...base, postalCodeField: "cp" } })).join()).toContain("duplicateCheck.postalCodeField");
  });

  it("refuse confirmOnSubmit sans postalCodeField", () => {
    const { postalCodeField: _drop, ...rest } = doc().duplicateCheck;
    expect(issues(doc({ duplicateCheck: rest })).join()).toContain("duplicateCheck.confirmOnSubmit");
  });

  it("refuse un slot déclaré mais ancré dans aucune section (groups ou format plat)", () => {
    expect(issues(doc({ sections: [{ id: "info", groups: [{ columns: 1, fields: ["name"] }] }] })).join()).toContain("ancré dans aucune section");
    expect(issues(doc({ sections: [{ id: "info", fields: ["name", "$slot:duplicates"] }] }))).toEqual([]);
  });

  it("refuse un bloc sans effet : ni slot, ni confirmation", () => {
    const d = doc({ slots: undefined, sections: [{ id: "info", fields: ["name"] }], duplicateCheck: { nameField: "name", search: { types: ["organizations"] } } });
    expect(issues(d).join()).toContain("bloc sans effet");
  });

  it("accepte la confirmation seule, sans slot", () => {
    expect(issues(doc({ slots: undefined, sections: [{ id: "info", fields: ["name"] }] }))).toEqual([]);
  });
});
