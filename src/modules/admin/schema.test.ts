import { describe, it, expect } from "vitest";
import { AdminColumnsSchema } from "./schema";

/**
 * `sortable` gouverne un tri SERVEUR : une colonne fabriquée après la requête (champs
 * aplatis par un hook costum, jointures) trierait sur une clé absente de la base, dans un
 * ordre arbitraire, tout en écrasant `defaultSortBy`. Le risque n'est pas qu'elle soit mal
 * lue mais qu'elle DISPARAISSE du schéma : Zod strippe les clés inconnues sans erreur, et
 * les tris morts reviendraient en silence — d'où ce test de contrat.
 */
describe("AdminColumnsSchema — sortable", () => {
  it("conserve `sortable: false` (clé déclarée, non strippée)", () => {
    const r = AdminColumnsSchema.safeParse([{ path: "structure.name", sortable: false }]);
    expect(r.success).toBe(true);
    expect(r.data?.[0]).toEqual({ path: "structure.name", sortable: false });
  });

  it("absent par défaut : le tri reste actif (comportement historique)", () => {
    const r = AdminColumnsSchema.safeParse([{ path: "created" }]);
    expect((r.data?.[0] as { sortable?: boolean })?.sortable).toBeUndefined();
  });

  it("accepte toujours la forme chaîne brute", () => {
    expect(AdminColumnsSchema.safeParse(["name"]).success).toBe(true);
  });

  it("rejette un `sortable` non booléen", () => {
    expect(AdminColumnsSchema.safeParse([{ path: "name", sortable: "non" }]).success).toBe(false);
  });
});
