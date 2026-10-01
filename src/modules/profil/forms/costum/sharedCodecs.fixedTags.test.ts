/**
 * Codec de groupe `fixedTags` — mots-clés IMPOSÉS par le formulaire (params `{field, fixed[]}`).
 * Testé par le registre (`applyTransform`), exactement comme le pipeline l'appelle : valeur, toutes
 * les valeurs, params.
 */
import { describe, it, expect } from "vitest";
import { applyTransform } from "@/modules/formEngine/engine/transforms";
import { tagsAvecFixes, tagsLibres } from "./sharedCodecs"; // + side-effect : enregistre fixedTags:read/write

const P = { field: "tags", fixed: ["lieux-sante"] };
const lit = (tags: unknown, p: Record<string, unknown> = P) => applyTransform("fixedTags:read", tags, {}, p);
const ecrit = (tags: unknown, p: Record<string, unknown> = P) => applyTransform("fixedTags:write", undefined, { tags }, p);

describe("fixedTags — lecture (ce que le widget affiche)", () => {
  it("ne montre que les mots-clés libres", () => {
    expect(lit(["lieux-sante", "pharmacie", "garde"])).toEqual({ tags: ["pharmacie", "garde"] });
  });

  it("fiche sans tags, tag scalaire, valeurs non textuelles : toujours un tableau de chaînes", () => {
    expect(lit(undefined)).toEqual({ tags: [] });
    expect(lit("pharmacie")).toEqual({ tags: ["pharmacie"] });
    expect(lit(["pharmacie", 3, null, ""])).toEqual({ tags: ["pharmacie"] });
  });

  it("le nom du champ suit params.field", () => {
    expect(lit(["a"], { field: "motsCles", fixed: [] })).toEqual({ motsCles: ["a"] });
  });
});

describe("fixedTags — écriture (ce qui part au serveur)", () => {
  it("les imposés reviennent en tête, sans doublon, l'ordre des libres préservé", () => {
    expect(ecrit(["garde", "lieux-sante", "pharmacie"])).toEqual(["lieux-sante", "garde", "pharmacie"]);
  });

  it("aucun mot-clé libre : seulement les imposés — jamais vide, la fiche reste dans l'annuaire", () => {
    expect(ecrit([])).toEqual(["lieux-sante"]);
    expect(ecrit(undefined)).toEqual(["lieux-sante"]);
  });

  it("un mot-clé libre retiré reste retiré (aller-retour lecture → écriture)", () => {
    const affiche = lit(["lieux-sante", "pharmacie", "garde"]) as { tags: string[] };
    const sansGarde = affiche.tags.filter((t) => t !== "garde");
    expect(ecrit(sansGarde)).toEqual(["lieux-sante", "pharmacie"]);
  });

  it("sans params.fixed : identité (aucun tag imposé)", () => {
    expect(ecrit(["a", "a", "b"], { field: "tags" })).toEqual(["a", "b"]);
    expect(ecrit([], {})).toEqual([]);
  });
});

describe("fixedTags — helpers purs", () => {
  it("tagsLibres / tagsAvecFixes sont inverses l'un de l'autre sur les libres", () => {
    const fixes = ["lieux-sante", "reunion"];
    const enBase = ["reunion", "kine", "lieux-sante"];
    expect(tagsLibres(enBase, fixes)).toEqual(["kine"]);
    expect(tagsAvecFixes(tagsLibres(enBase, fixes), fixes)).toEqual(["lieux-sante", "reunion", "kine"]);
  });
});
