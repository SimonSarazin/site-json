import { describe, it, expect } from "vitest";
import { toggleSelectedFilters, toggleSearchByField, toggleSearchTarget, setDateRange } from "./filterToggles";

/**
 * Tests de caractérisation (étape 0 du refactor TitleWithFilters → search).
 * Verrouillent le *shape* exact produit dans `selectedFilters` / `searchByFields`,
 * consommé par `<SearchProStatic>`. Toute régression de forme casse le filtrage.
 */

describe("toggleSelectedFilters", () => {
  it("ajoute un filtre absent dans le groupe", () => {
    expect(toggleSelectedFilters({}, "type", "NGO")).toEqual({ type: ["NGO"] });
  });

  it("retire un filtre déjà présent (toggle off)", () => {
    expect(toggleSelectedFilters({ type: ["NGO"] }, "type", "NGO")).toEqual({ type: [] });
  });

  it("conserve les autres valeurs du groupe lors d'un ajout", () => {
    expect(toggleSelectedFilters({ type: ["NGO"] }, "type", "Group")).toEqual({
      type: ["NGO", "Group"],
    });
  });

  it("n'affecte pas les autres groupes", () => {
    expect(toggleSelectedFilters({ role: ["a"] }, "type", "NGO")).toEqual({
      role: ["a"],
      type: ["NGO"],
    });
  });

  it("ne mute pas l'objet d'entrée", () => {
    const prev = { type: ["NGO"] };
    toggleSelectedFilters(prev, "type", "Group");
    expect(prev).toEqual({ type: ["NGO"] });
  });
});

describe("toggleSearchByField", () => {
  it("ajoute un filtre par champ simple, value enveloppée en tableau", () => {
    expect(toggleSearchByField({}, "f1", { field: "tags", value: "sport" })).toEqual({
      f1: { field: "tags", value: ["sport"] },
    });
  });

  it("conserve une value déjà en tableau sans la réenvelopper", () => {
    expect(toggleSearchByField({}, "f1", { field: "tags", value: ["a", "b"] })).toEqual({
      f1: { field: "tags", value: ["a", "b"] },
    });
  });

  it("toggle off retire exactement la clé active", () => {
    expect(
      toggleSearchByField({ f1: { field: "tags", value: ["sport"] } }, "f1", {
        field: "tags",
        value: "sport",
      }),
    ).toEqual({});
  });

  it("scopeList (level) → { field, type:'scopeList', value:{ id, type:level } }", () => {
    expect(
      toggleSearchByField({}, "z1", { field: "geo", value: "z1", level: "level2" }),
    ).toEqual({
      z1: { field: "geo", type: "scopeList", value: { id: "z1", type: "level2" } },
    });
  });

  it("champ typé (fieldType, ex. sourceKey) → { field, type, value:[...] }", () => {
    expect(
      toggleSearchByField({}, "e1", {
        field: "sourceKey",
        value: "slugA",
        fieldType: "sourceKey",
      }),
    ).toEqual({ e1: { field: "sourceKey", type: "sourceKey", value: ["slugA"] } });
  });

  it("préserve les autres clés lors d'un ajout", () => {
    const prev = { other: { field: "x", value: ["y"] } };
    expect(toggleSearchByField(prev, "f1", { field: "tags", value: "sport" })).toEqual({
      other: { field: "x", value: ["y"] },
      f1: { field: "tags", value: ["sport"] },
    });
  });

  it("ne mute pas l'objet d'entrée lors d'un retrait", () => {
    const prev = { f1: { field: "tags", value: ["sport"] } };
    toggleSearchByField(prev, "f1", { field: "tags", value: "sport" });
    expect(prev).toEqual({ f1: { field: "tags", value: ["sport"] } });
  });
});

describe("toggleSearchTarget (filtre « type d'info », sémantique radio)", () => {
  const GROUP = ["typeinfo-actions", "typeinfo-paroles", "typeinfo-evenements"];
  const PAROLES = { defaultTypes: ["poi"], defaultFilters: { type: "affiche" } };

  it("sélection → entrée { field/type searchTarget, value: target }", () => {
    expect(toggleSearchTarget({}, GROUP, "typeinfo-paroles", PAROLES)).toEqual({
      "typeinfo-paroles": { field: "searchTarget", type: "searchTarget", value: PAROLES },
    });
  });

  it("radio : sélectionner une option retire les autres options du groupe", () => {
    const prev = {
      "typeinfo-actions": { field: "searchTarget", type: "searchTarget", value: {} },
      autre: { field: "tags", value: ["sport"] },
    };
    expect(toggleSearchTarget(prev, GROUP, "typeinfo-paroles", PAROLES)).toEqual({
      autre: { field: "tags", value: ["sport"] },
      "typeinfo-paroles": { field: "searchTarget", type: "searchTarget", value: PAROLES },
    });
  });

  it("re-cliquer l'option active → retour à « Tout » (aucune entrée du groupe)", () => {
    const prev = {
      "typeinfo-paroles": { field: "searchTarget", type: "searchTarget", value: PAROLES },
      autre: { field: "tags", value: ["sport"] },
    };
    expect(toggleSearchTarget(prev, GROUP, "typeinfo-paroles", PAROLES)).toEqual({
      autre: { field: "tags", value: ["sport"] },
    });
  });

  it("ne mute pas l'objet d'entrée", () => {
    const prev = {
      "typeinfo-actions": { field: "searchTarget", type: "searchTarget", value: {} },
    };
    toggleSearchTarget(prev, GROUP, "typeinfo-paroles", PAROLES);
    expect(prev).toEqual({
      "typeinfo-actions": { field: "searchTarget", type: "searchTarget", value: {} },
    });
  });
});

describe("setDateRange (filtre par date, une plage par groupe)", () => {
  it("pose la plage sous la clé du groupe (bornes vides omises)", () => {
    expect(setDateRange({}, "dates", "startDate", { start: "2026-07-01" })).toEqual({
      dates: { field: "startDate", type: "dateRange", value: { start: "2026-07-01" } },
    });
  });

  it("remplace la plage existante et préserve les autres clés", () => {
    const prev = {
      dates: { field: "startDate", type: "dateRange", value: { start: "2026-01-01" } },
      autre: { field: "tags", value: ["sport"] },
    };
    expect(setDateRange(prev, "dates", "startDate", { start: "2026-07-01", end: "2026-08-31" })).toEqual({
      autre: { field: "tags", value: ["sport"] },
      dates: { field: "startDate", type: "dateRange", value: { start: "2026-07-01", end: "2026-08-31" } },
    });
  });

  it("bornes toutes vides → entrée retirée", () => {
    const prev = { dates: { field: "startDate", type: "dateRange", value: { start: "2026-01-01" } } };
    expect(setDateRange(prev, "dates", "startDate", { start: "", end: "" })).toEqual({});
  });
});
