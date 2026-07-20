import { describe, it, expect } from "vitest";
import { decorateTags, resolveColorBy, stripTagNamespace } from "./colorBy";

const TERRITOIRES = {
  "territoire62:arrageois": "var(--territoire-arrageois)",
  "territoire62:calaisis": "var(--territoire-calaisis)",
};

describe("resolveColorBy (couleur par valeur de serverData)", () => {
  it("premier tag de l'ITEM présent dans le mapping gagnant (ordre item, pas mapping)", () => {
    const match = resolveColorBy(
      { tags: ["santé", "territoire62:calaisis", "territoire62:arrageois"] },
      { mapping: TERRITOIRES },
    );
    expect(match).toEqual({
      value: "territoire62:calaisis",
      cssColor: "var(--territoire-calaisis)",
    });
  });

  it("path par défaut = tags ; dot-path et valeur scalaire supportés", () => {
    expect(
      resolveColorBy(
        { source: { key: "parents62" } },
        { path: "source.key", mapping: { parents62: "var(--primary)" } },
      ),
    ).toEqual({ value: "parents62", cssColor: "var(--primary)" });
  });

  it("aucune valeur mappée / données absentes → null", () => {
    expect(resolveColorBy({ tags: ["santé"] }, { mapping: TERRITOIRES })).toBeNull();
    expect(resolveColorBy({}, { mapping: TERRITOIRES })).toBeNull();
    expect(resolveColorBy(undefined, { mapping: TERRITOIRES })).toBeNull();
  });
});

describe("stripTagNamespace", () => {
  it("retire le namespace et capitalise", () => {
    expect(stripTagNamespace("territoire62:arrageois")).toBe("Arrageois");
    expect(stripTagNamespace("santé")).toBe("Santé");
  });
});

describe("decorateTags (chips des cartes)", () => {
  const conf = {
    mapping: TERRITOIRES,
    labels: { "territoire62:calaisis": "Le Calaisis" },
    hidePrefixes: ["public:", "age:"],
  };

  it("tag mappé → chip colorée, libellé lisible (labels > namespace retiré)", () => {
    expect(decorateTags(["territoire62:arrageois", "territoire62:calaisis"], conf)).toEqual([
      { tag: "territoire62:arrageois", label: "Arrageois", cssColor: "var(--territoire-arrageois)" },
      { tag: "territoire62:calaisis", label: "Le Calaisis", cssColor: "var(--territoire-calaisis)" },
    ]);
  });

  it("tags techniques masqués (hidePrefixes), tags libres inchangés", () => {
    expect(decorateTags(["public:parents", "age:0-3", "santé"], conf)).toEqual([
      { tag: "santé", label: "santé" },
    ]);
  });

  it("sans conf → identité (comportement historique des cartes)", () => {
    expect(decorateTags(["a", "public:parents"], undefined)).toEqual([
      { tag: "a", label: "a" },
      { tag: "public:parents", label: "public:parents" },
    ]);
  });
});
