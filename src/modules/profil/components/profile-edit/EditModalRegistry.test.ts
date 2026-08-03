import { describe, it, expect } from "vitest";

import { resolveEditModalName } from "./EditModalRegistry";

import type { EntityTypes } from "@communecter/cocolight-api-client";

/** Entité factice : seul getEntityType() + serverData comptent pour resolveEditModalName. */
function ent(kind: string, serverData: Record<string, unknown>): EntityTypes {
  return { getEntityType: () => kind, serverData } as unknown as EntityTypes;
}
/** Config factice : seule `profiles` est lue. */
function cfg(profiles: Record<string, unknown>) {
  return { profiles } as unknown as Parameters<typeof resolveEditModalName>[1];
}

describe("resolveEditModalName — routage table (multi sous-types) + rétro-compat", () => {
  it("table editModals : le PREMIER dont editModalMatch matche gagne (par serverData.type)", () => {
    const config = cfg({
      poi: {
        editModals: [
          { editModal: "edit-ssb-recovery-center", editModalMatch: { type: "recoveryCenter" } },
          { editModal: "edit-ssb-article", editModalMatch: { type: "article" } },
        ],
      },
    });
    expect(resolveEditModalName(ent("poi", { type: "recoveryCenter" }), config)).toBe("edit-ssb-recovery-center");
    expect(resolveEditModalName(ent("poi", { type: "article" }), config)).toBe("edit-ssb-article");
    // aucun type ne matche → générique
    expect(resolveEditModalName(ent("poi", { type: "autre" }), config)).toBe("edit-profile");
  });

  it("catch-all (sans editModalMatch) doit être placé EN DERNIER pour ne pas masquer les sous-types", () => {
    const config = cfg({
      organizations: {
        editModals: [
          { editModal: "edit-ssb-mss", editModalMatch: { type: "NGO" } },
          { editModal: "edit-ssb-organizations" }, // catch-all
        ],
      },
    });
    expect(resolveEditModalName(ent("organizations", { type: "NGO" }), config)).toBe("edit-ssb-mss");
    expect(resolveEditModalName(ent("organizations", { type: "Group" }), config)).toBe("edit-ssb-organizations"); // catch-all
  });

  it("rétro-compat : editModal unique conditionnel (ancien format) toujours honoré", () => {
    const config = cfg({ organizations: { editModal: "edit-tiers-lieux", editModalMatch: { tags: "TiersLieux" } } });
    expect(resolveEditModalName(ent("organizations", { tags: ["TiersLieux"] }), config)).toBe("edit-tiers-lieux");
    expect(resolveEditModalName(ent("organizations", { tags: ["Autre"] }), config)).toBe("edit-profile");
  });

  it("pas de config profil pour le kind → générique", () => {
    expect(resolveEditModalName(ent("events", { type: "x" }), cfg({}))).toBe("edit-profile");
  });

  it("table PUIS fallback editModal unique (les deux définis)", () => {
    const config = cfg({
      poi: {
        editModals: [{ editModal: "edit-ssb-recovery-center", editModalMatch: { type: "recoveryCenter" } }],
        editModal: "edit-ssb-fallback",
      },
    });
    expect(resolveEditModalName(ent("poi", { type: "recoveryCenter" }), config)).toBe("edit-ssb-recovery-center"); // table gagne
    expect(resolveEditModalName(ent("poi", { type: "x" }), config)).toBe("edit-ssb-fallback"); // sinon fallback unique (sans match → always)
  });
});
