import { describe, it, expect } from "vitest";
import { EMPTY_AAC_FILTERS, type AacDirectoryFiltersState } from "./filtersKey";
import type { AacUsageOption } from "./aacUsage";
import {
  maturityOptionsOf,
  resetFilters,
  toggleIn,
  toggleSort,
  toggleUsageCategory,
  visibleUsageSubs,
} from "./directoryFilterActions";

const sub = (id: string): AacUsageOption => ({ id, label: id, count: 1, children: [] });
const TREE: AacUsageOption[] = [
  { id: "outil", label: "Outil", count: 3, children: [sub("outil/logiciel"), sub("outil/materiel")] },
  { id: "savoir", label: "Savoir", count: 2, children: [sub("savoir/guide")] },
];
const state = (patch: Partial<AacDirectoryFiltersState>): AacDirectoryFiltersState => ({ ...EMPTY_AAC_FILTERS, ...patch });

describe("toggleIn", () => {
  it("ajoute l'absent, retire le présent, sans muter", () => {
    const list = ["a"];
    expect(toggleIn(list, "b")).toEqual(["a", "b"]);
    expect(toggleIn(list, "a")).toEqual([]);
    expect(list).toEqual(["a"]);
  });
});

describe("toggleUsageCategory", () => {
  it("décocher une catégorie fait tomber ses sous-catégories devenues inatteignables", () => {
    const next = toggleUsageCategory(
      state({ usage: ["outil", "savoir"], usageSub: ["outil/logiciel", "savoir/guide"] }),
      TREE,
      "outil"
    );
    expect(next.usage).toEqual(["savoir"]);
    expect(next.usageSub).toEqual(["savoir/guide"]);
  });

  it("plus aucune catégorie : « Tous » réaffiche tout, la sous-catégorie cochée reste", () => {
    const next = toggleUsageCategory(state({ usage: ["outil"], usageSub: ["outil/logiciel"] }), TREE, "outil");
    expect(next.usage).toEqual([]);
    expect(next.usageSub).toEqual(["outil/logiciel"]);
  });

  it("ne touche pas aux autres filtres", () => {
    const next = toggleUsageCategory(state({ q: "eau", tags: ["x"] }), TREE, "savoir");
    expect(next.q).toBe("eau");
    expect(next.tags).toEqual(["x"]);
  });
});

describe("visibleUsageSubs", () => {
  it("aucune catégorie retenue : toutes les sous-catégories", () => {
    expect(visibleUsageSubs(TREE, []).map((s) => s.id)).toEqual(["outil/logiciel", "outil/materiel", "savoir/guide"]);
  });

  it("sinon, celles des seules catégories retenues", () => {
    expect(visibleUsageSubs(TREE, ["savoir"]).map((s) => s.id)).toEqual(["savoir/guide"]);
  });
});

describe("maturityOptionsOf", () => {
  it("les options du formulaire, à ses propres libellés ; sans question, aucune", () => {
    const field = { stepKey: "s", id: "m", path: "answers.s.m", label: "Utilisable ?", options: [{ value: "oui", label: "Oui" }] };
    expect(maturityOptionsOf(field)).toEqual([{ id: "oui", label: "Oui" }]);
    expect(maturityOptionsOf(null)).toEqual([]);
  });
});

describe("toggleSort / resetFilters", () => {
  it("re-choisir le tri actif le retire", () => {
    expect(toggleSort(state({}), "alpha").sort).toBe("alpha");
    expect(toggleSort(state({ sort: "alpha" }), "alpha").sort).toBe("");
  });

  it("tout revient à zéro, recherche comprise — et un état neuf à chaque appel", () => {
    expect(resetFilters()).toEqual(EMPTY_AAC_FILTERS);
    expect(resetFilters().tags).not.toBe(resetFilters().tags);
    expect(resetFilters().commune).not.toBe(resetFilters().commune);
  });
});
