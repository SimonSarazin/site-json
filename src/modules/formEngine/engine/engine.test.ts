import { describe, it, expect } from "vitest";
import { evaluatePredicate } from "./conditional";
import { buildZodSchema } from "./zodGen";
import type { FormDescriptor } from "../types";

describe("evaluatePredicate", () => {
  const v = { country: "FR", mgmt: "autre", count: 3, flag: true, tags: [] as string[], name: "", family: ["autre", "coworking"] };
  it("opérateurs simples", () => {
    expect(evaluatePredicate({ field: "country", op: "eq", value: "FR" }, v)).toBe(true);
    expect(evaluatePredicate({ field: "country", op: "ne", value: "FR" }, v)).toBe(false);
    expect(evaluatePredicate({ field: "mgmt", op: "in", value: ["autre", "x"] }, v)).toBe(true);
    expect(evaluatePredicate({ field: "count", op: "gte", value: 3 }, v)).toBe(true);
    expect(evaluatePredicate({ field: "flag", op: "truthy" }, v)).toBe(true);
    expect(evaluatePredicate({ field: "tags", op: "empty" }, v)).toBe(true);
    expect(evaluatePredicate({ field: "name", op: "notEmpty" }, v)).toBe(false);
  });
  it("contains (tableau multi-select OU string)", () => {
    // tableau (ex. family multi-sélection inclut 'autre' → afficher familyOther)
    expect(evaluatePredicate({ field: "family", op: "contains", value: "autre" }, v)).toBe(true);
    expect(evaluatePredicate({ field: "family", op: "contains", value: "absent" }, v)).toBe(false);
    // string
    expect(evaluatePredicate({ field: "country", op: "contains", value: "F" }, v)).toBe(true);
    // valeur non-tableau/non-string → false
    expect(evaluatePredicate({ field: "count", op: "contains", value: "3" }, v)).toBe(false);
  });
  it("combinateurs and/or/not", () => {
    expect(evaluatePredicate({ and: [{ field: "country", op: "eq", value: "FR" }, { field: "flag", op: "truthy" }] }, v)).toBe(true);
    expect(evaluatePredicate({ or: [{ field: "country", op: "eq", value: "BE" }, { field: "flag", op: "truthy" }] }, v)).toBe(true);
    expect(evaluatePredicate({ not: { field: "country", op: "eq", value: "FR" } }, v)).toBe(false);
  });
});

describe("buildZodSchema", () => {
  const desc: FormDescriptor = {
    id: "t", collection: "organizations", layout: { kind: "flat" }, sections: [],
    fields: {
      name: { name: "name", type: "string", widget: "text", label: "Name", required: true },
      mgmt: { name: "mgmt", type: "string", widget: "select", label: "Mgmt" },
      // requis SEULEMENT si mgmt == "autre"
      mgmtOther: { name: "mgmtOther", type: "string", widget: "text", label: "Autre",
                   visibleIf: { field: "mgmt", op: "eq", value: "autre" },
                   requiredIf: { field: "mgmt", op: "eq", value: "autre" } },
      url: { name: "url", type: "string", widget: "text", label: "URL", rules: { url: true } },
    },
  };
  const schema = buildZodSchema(desc);

  it("champ requis vide → erreur", () => {
    const r = schema.safeParse({ name: "" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues.some((i) => i.path[0] === "name" && i.message === "validation.required")).toBe(true);
  });
  it("requiredIf : mgmtOther requis quand mgmt=autre", () => {
    const bad = schema.safeParse({ name: "X", mgmt: "autre", mgmtOther: "" });
    expect(bad.success).toBe(false);
    const ok = schema.safeParse({ name: "X", mgmt: "autre", mgmtOther: "Coop" });
    expect(ok.success).toBe(true);
  });
  it("champ caché (visibleIf faux) non validé même si requiredIf", () => {
    // mgmt != autre → mgmtOther caché → pas d'erreur même vide
    const r = schema.safeParse({ name: "X", mgmt: "asso", mgmtOther: "" });
    expect(r.success).toBe(true);
  });
  it("règle url appliquée si non vide", () => {
    expect(schema.safeParse({ name: "X", url: "pas-une-url" }).success).toBe(false);
    expect(schema.safeParse({ name: "X", url: "https://x.fr" }).success).toBe(true);
    expect(schema.safeParse({ name: "X", url: "" }).success).toBe(true); // vide non requis → ok
  });
});
