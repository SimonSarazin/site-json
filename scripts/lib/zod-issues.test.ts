import { describe, it, expect } from "vitest";
import { z } from "zod";

import { AdminSectionSchema } from "../../src/modules/admin/schema";
import { flattenIssues } from "./zod-issues";

/**
 * `config:validate` imprime ces erreurs : une union qui ne dit que « Invalid input » laisse
 * l'auteur de config sans piste. Le contrat : l'erreur de la branche qui a reconnu l'objet, au
 * chemin complet.
 */
describe("flattenIssues", () => {
  it("une erreur hors union passe telle quelle, préfixée", () => {
    const r = z.object({ n: z.number() }).safeParse({ n: "x" });
    expect(flattenIssues(r.error?.issues ?? [], ["pages", 0])).toEqual([
      { path: ["pages", 0, "n"], message: expect.any(String), code: "invalid_type" },
    ]);
  });

  it("section admin builtin fautive : l'erreur de SON schéma, pas le refus du repli costum", () => {
    const r = AdminSectionSchema.safeParse({ type: "resource", entityType: "poi", rowActions: ["edite"] });
    expect(r.error?.issues.map((i) => i.code)).toEqual(["invalid_union"]); // la sonde produit bien l'union opaque
    const flat = flattenIssues(r.error?.issues ?? [], ["admin", "tabs", 0, "sections", 0]);
    expect(flat.map((i) => i.path.join("."))).toEqual(["admin.tabs.0.sections.0.rowActions.0"]);
    expect(flat[0]?.code).toBe("invalid_value");
  });

  it("branches ex æquo : toutes imprimées, sans deviner", () => {
    const schema = z.union([z.object({ a: z.string() }), z.object({ b: z.string() })]);
    const r = schema.safeParse({});
    expect(flattenIssues(r.error?.issues ?? []).map((i) => i.path.join("."))).toEqual(["a", "b"]);
  });

  it("union sans détail (aucune branche) : l'erreur d'union reste, rien n'est perdu", () => {
    const issue = { code: "invalid_union", path: ["x"], message: "Invalid input", errors: [], input: 1 } as unknown as z.core.$ZodIssue;
    expect(flattenIssues([issue])).toEqual([{ path: ["x"], message: "Invalid input", code: "invalid_union" }]);
  });
});
