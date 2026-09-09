import { describe, expect, it } from "vitest";
import {
  aacFiltersKey,
  hasActiveFilters,
  EMPTY_AAC_FILTERS,
  type AacDirectoryFiltersState,
} from "./filtersKey";

const f = (p: Partial<AacDirectoryFiltersState> = {}): AacDirectoryFiltersState => ({
  ...EMPTY_AAC_FILTERS,
  ...p,
});
const key = (s: AacDirectoryFiltersState, pageSize = 12) =>
  aacFiltersKey(s, { pageSize });

describe("aacFiltersKey", () => {
  it("l'ORDRE DE COCHAGE ne change pas la clé", () => {
    expect(key(f({ tags: ["b", "a"] }))).toBe(key(f({ tags: ["a", "b"] })));
    expect(key(f({ maturity: ["z", "a", "m"] }))).toBe(
      key(f({ maturity: ["a", "m", "z"] }))
    );
  });

  it("dédoublonne et ignore les entrées vides", () => {
    expect(key(f({ tags: ["a", "a", "  ", "b"] }))).toBe(key(f({ tags: ["a", "b"] })));
  });

  it("normalise le texte : trim + casse", () => {
    expect(key(f({ q: "  CoOp  " }))).toBe(key(f({ q: "coop" })));
  });

  it("des filtres DIFFÉRENTS donnent des clés différentes", () => {
    const base = key(f());
    expect(key(f({ q: "coop" }))).not.toBe(base);
    expect(key(f({ tags: ["a"] }))).not.toBe(base);
    expect(key(f({ maturity: ["a"] }))).not.toBe(base);
    expect(key(f({ tags: ["a"] }))).not.toBe(key(f({ maturity: ["a"] })));
  });

  it("ne confond pas une valeur de tags avec une valeur de maturité", () => {
    expect(key(f({ tags: ["x"], maturity: [] }))).not.toBe(
      key(f({ tags: [], maturity: ["x"] }))
    );
  });

  it("pageSize entre dans la clé", () => {
    expect(key(f(), 12)).not.toBe(key(f(), 24));
  });

  it("retourne toujours une chaîne, même sans aucun filtre", () => {
    expect(typeof key(f())).toBe("string");
    expect(key(f())).not.toBe("");
  });

  it("est stable d'un appel à l'autre", () => {
    const s = f({ q: "a", tags: ["t1", "t2"], maturity: ["m"] });
    expect(key(s)).toBe(key(s));
  });
});

describe("hasActiveFilters", () => {
  it("faux sur l'état vide, vrai dès qu'un filtre porte", () => {
    expect(hasActiveFilters(f())).toBe(false);
    expect(hasActiveFilters(f({ q: "   " }))).toBe(false);
    expect(hasActiveFilters(f({ q: "a" }))).toBe(true);
    expect(hasActiveFilters(f({ tags: ["a"] }))).toBe(true);
    expect(hasActiveFilters(f({ maturity: ["a"] }))).toBe(true);
  });
});
