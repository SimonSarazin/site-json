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

/**
 * Périmètre costum : une route sans condition s'applique à TOUTES les entités du type (catch-all),
 * y compris étrangères au costum. Le borner exige une condition DISJONCTIVE — provenance OU
 * rattachement secondaire — donc le prédicat `when`, hors de portée d'`editModalMatch` (AND plat).
 */
describe("resolveEditModalName — prédicat `when` (périmètre costum)", () => {
  const IB = "institutBleu";
  const scoped = cfg({
    organizations: {
      editModals: [{
        editModal: "edit-institut-bleu-acteur",
        when: {
          and: [
            { or: [
              { field: "sourceKeys", op: "contains", value: IB },
              { field: "reference.costum", op: "contains", value: IB },
            ] },
            { field: "slug", op: "ne", value: IB },
          ],
        },
      }],
    },
  });

  it("provenance source.keys → form costum", () => {
    const e = ent("organizations", { slug: "acteur1", source: { key: IB, keys: [IB] } });
    expect(resolveEditModalName(e, scoped)).toBe("edit-institut-bleu-acteur");
  });

  it("source.key SEUL (sans keys) suffit : `sourceKeys` synthétise les deux", () => {
    const e = ent("organizations", { slug: "acteur2", source: { key: IB } });
    expect(resolveEditModalName(e, scoped)).toBe("edit-institut-bleu-acteur");
  });

  it("`source.keys` en OBJET À TROUS (byte-parité d'un unset PHP) reste matché", () => {
    const e = ent("organizations", { slug: "acteur3", source: { keys: { "0": "autre", "2": IB } } });
    expect(resolveEditModalName(e, scoped)).toBe("edit-institut-bleu-acteur");
  });

  it("rattachement secondaire (reference.costum, chemin POINTÉ) → form costum", () => {
    // 21 des 74 acteurs institutBleu sont dans ce cas : rattachés sans provenance.
    const e = ent("organizations", { slug: "lyceeX", reference: { costum: [IB] } });
    expect(resolveEditModalName(e, scoped)).toBe("edit-institut-bleu-acteur");
  });

  it("organisation ÉTRANGÈRE au costum → form générique (le bug corrigé)", () => {
    const e = ent("organizations", { slug: "libertalia", source: { key: "autreCostum", keys: ["autreCostum"] } });
    expect(resolveEditModalName(e, scoped)).toBe("edit-profile");
  });

  it("organisation sans aucune provenance → form générique", () => {
    expect(resolveEditModalName(ent("organizations", { slug: "nue" }), scoped)).toBe("edit-profile");
  });

  it("l'organisation PORTEUSE est exclue par la clause slug, malgré son rattachement", () => {
    // Cas réel : la porteuse a source.key="meir" mais reference.costum=["institutBleu"].
    const holder = ent("organizations", { slug: IB, source: { key: "meir", keys: ["meir"] }, reference: { costum: [IB] } });
    expect(resolveEditModalName(holder, scoped)).toBe("edit-profile");
  });

  it("un acteur portant SON PROPRE costum n'est PAS confondu avec la porteuse", () => {
    // Open Atlas : acteur légitime qui a aussi son site — d'où une clause sur le slug, pas sur `costum`.
    const e = ent("organizations", { slug: "openAtlas", costum: { slug: "OpenAtlas" }, source: { key: IB, keys: [IB] } });
    expect(resolveEditModalName(e, scoped)).toBe("edit-institut-bleu-acteur");
  });

  it("`when` et `editModalMatch` sont CUMULATIFS (AND)", () => {
    const config = cfg({
      poi: {
        editModals: [{
          editModal: "edit-x",
          editModalMatch: { type: "recoveryCenter" },
          when: { field: "sourceKeys", op: "contains", value: IB },
        }],
      },
    });
    expect(resolveEditModalName(ent("poi", { type: "recoveryCenter", source: { key: IB } }), config)).toBe("edit-x");
    expect(resolveEditModalName(ent("poi", { type: "recoveryCenter", source: { key: "autre" } }), config)).toBe("edit-profile");
    expect(resolveEditModalName(ent("poi", { type: "article", source: { key: IB } }), config)).toBe("edit-profile");
  });

  it("prédicat MALFORMÉ → route ignorée (générique), pas de crash", () => {
    const config = cfg({
      organizations: { editModals: [{ editModal: "edit-boom", when: { field: "slug", op: "matches", value: "([" } }] },
    });
    expect(resolveEditModalName(ent("organizations", { slug: "x" }), config)).toBe("edit-profile");
  });
});
