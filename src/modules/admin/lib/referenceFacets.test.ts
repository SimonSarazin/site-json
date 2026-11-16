import { describe, expect, it } from "vitest";

import { applyReferenceFacets } from "./referenceFacets";

const guard = { "reference.costum": { $nin: ["tl"] }, "source.keys": { $nin: ["tl"] } };

describe("applyReferenceFacets", () => {
  it("sans panneau : mêmes baseParams (même référence), aucun tag", () => {
    const bp = { notSourceKey: true, defaultFilters: guard };
    const out = applyReferenceFacets(bp, null);
    expect(out.baseParams).toBe(bp);
    expect(out.searchTags).toEqual({});
  });

  it("tags cochés → searchTags ; rien d'autre : baseParams inchangés", () => {
    const bp = { notSourceKey: true, defaultFilters: guard };
    const out = applyReferenceFacets(bp, { filterNames: ["Fablab"], searchByFields: {} });
    expect(out.searchTags).toEqual({ tags: ["Fablab"] });
    expect(out.baseParams).toBe(bp);
  });

  it("facettes et zones s'ajoutent ; un garde-fou $nin reste, composé avec la facette de même clé", () => {
    const out = applyReferenceFacets(
      { notSourceKey: true, defaultFilters: guard },
      {
        filterNames: [],
        searchByFields: {
          a: { field: "_id", value: ["x"] },
          b: { field: "source.keys", value: ["intrus"] },
          r: { field: "level3", type: "scopeList", value: { r1: { id: "r1" } } },
        },
      },
    );
    expect(out.baseParams.defaultFilters).toEqual({
      _id: { $in: ["x"] },
      "reference.costum": { $nin: ["tl"] },
      "source.keys": { $in: ["intrus"], $nin: ["tl"] },
    });
    expect(out.baseParams.locality).toEqual({ level3: { r1: { id: "r1" } } });
    expect(out.baseParams.notSourceKey).toBe(true);
  });

  it("réseau coché : sourceKey remplace notSourceKey (Référencés)", () => {
    const out = applyReferenceFacets(
      { notSourceKey: true, defaultFilters: { "reference.costum": { $in: ["tl"] } } },
      { filterNames: [], searchByFields: { n: { field: "source", type: "sourceKey", value: ["reseauA"] } } },
    );
    expect(out.baseParams.sourceKey).toEqual(["reseauA"]);
    expect(out.baseParams.notSourceKey).toBeUndefined();
  });

  it("ignoreSourceKeys : le réseau est ignoré (recherche de candidates)", () => {
    const bp = { notSourceKey: true, defaultFilters: guard };
    const out = applyReferenceFacets(
      bp,
      { filterNames: [], searchByFields: { n: { field: "source", type: "sourceKey", value: ["reseauA"] } } },
      { ignoreSourceKeys: true },
    );
    expect(out.baseParams).toBe(bp);
  });
});
