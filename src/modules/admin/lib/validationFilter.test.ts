import { describe, it, expect } from "vitest";
import { mergeMongoFilters } from "@/modules/search/lib/mongoFilters";
import { validationStatusFilter } from "./validationFilter";

const SLUG = "EcosystemeSanteReunion";
/** Périmètre d'une resource admin rattachée par provenance (forme MAP legacy de `$or`). */
const perimetre = { $or: { "source.key": SLUG, "source.keys": SLUG, "reference.costum": SLUG } };

describe("validationStatusFilter composé avec un périmètre en $or", () => {
  it("« validé » : deux clés distinctes, le périmètre reste intact", () => {
    const f = mergeMongoFilters(perimetre, validationStatusFilter(SLUG, "validated"));
    expect(f.$or).toEqual(perimetre.$or);
    expect(f[`preferences.toBeValidated.${SLUG}`]).toEqual({ $exists: false });
    expect(f[`source.toBeValidated.${SLUG}`]).toEqual({ $exists: false });
  });

  it("« en attente » : les deux $or sont composés en ET — ni le périmètre ni le statut n'est perdu", () => {
    const f = mergeMongoFilters(perimetre, validationStatusFilter(SLUG, "pending")) as { $or: { $and: unknown[] } };
    expect(f.$or.$and).toHaveLength(2);
    expect(JSON.stringify(f.$or.$and[0])).toContain("reference.costum");
    expect(JSON.stringify(f.$or.$and[1])).toContain("toBeValidated");
  });

  it("contre-épreuve : Object.assign aurait remplacé le périmètre par le statut", () => {
    const naif = Object.assign({ ...perimetre }, validationStatusFilter(SLUG, "pending"));
    expect(JSON.stringify(naif)).not.toContain("reference.costum");
  });
});
