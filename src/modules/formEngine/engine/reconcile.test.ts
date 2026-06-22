import { describe, it, expect } from "vitest";
import { isSameValue, reconcileClearedFields } from "./reconcile";

describe("isSameValue", () => {
  it("compare en JSON-stable, null ≡ undefined", () => {
    expect(isSameValue(null, undefined)).toBe(true);
    expect(isSameValue("", "")).toBe(true);
    expect(isSameValue("a", "b")).toBe(false);
    expect(isSameValue([1, 2], [1, 2])).toBe(true);
    expect(isSameValue({ a: 1 }, { a: 1 })).toBe(true);
    expect(isSameValue({ a: 1 }, { a: 2 })).toBe(false);
  });
});

describe("reconcileClearedFields", () => {
  it("émet un vide TYPÉ pour les clés du baseline ABSENTES du payload (champ vidé)", () => {
    const baseline = { holderOrganization: "kkk", socialNetwork: { facebook: "u" }, video: ["x"], name: "n" };
    const payload = { name: "n" }; // tout le reste vidé → omis du payload (build* omet les vides)
    const cleared = reconcileClearedFields(payload, baseline);
    expect(cleared).toEqual({ holderOrganization: "", socialNetwork: "", video: [] }); // objet → "" (PAS {}), array → []
  });

  it("n'efface PAS une clé présente dans le payload (modifiée ou inchangée)", () => {
    const cleared = reconcileClearedFields({ a: "new" }, { a: "old" });
    expect(cleared).toEqual({}); // `a` est dans le payload → pas du ressort de la réconciliation d'effacement
  });

  it("respecte `skip` (ex. address atomique, tags mergés)", () => {
    const baseline = { address: { x: 1 }, tags: ["t"], url: "http://x" };
    const cleared = reconcileClearedFields({}, baseline, { skip: ["address", "tags"] });
    expect(cleared).toEqual({ url: "" }); // address/tags exclus ; url vidé → ""
  });

  it("baseline vide → rien à effacer", () => {
    expect(reconcileClearedFields({ a: 1 }, {})).toEqual({});
  });
});
