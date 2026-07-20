import { describe, it, expect } from "vitest";
import { computeUrlFromFilters } from "./computeUrlFromFilters";
import { computeFiltersFromUrl, type FilterGroupLike } from "./computeFiltersFromUrl";
import type { SearchByFieldValue } from "../contexts/pageFilters";

const TYPO: FilterGroupLike = {
  id: "typologies",
  type: "tag",
  options: [{ id: "fablab", name: "fablab" }, { id: "coworking", name: "coworking" }],
};
const RESEAUX: FilterGroupLike = {
  id: "reseauxRegionaux",
  type: "entityList",
  filterType: "sourceKey",
  options: [{ id: "laRosee", name: "laRosee" }, { id: "autre", name: "autre" }],
};
// scopeList tel que construit par FiltersSection : options sans `name` (clé = id),
// avec `level`. field = group.field ?? `${id}${level}`.
const REGIONS: FilterGroupLike = {
  id: "regions",
  type: "scopeList",
  options: [{ id: "974", level: "level3" }, { id: "972", level: "level3" }],
};
const scopeEntry = (id: string, level: string) => ({
  field: `${id}${level}`,
  type: "scopeList",
  value: { id, type: level },
} as unknown as SearchByFieldValue);

describe("computeUrlFromFilters", () => {
  it("sérialise un groupe catégorie depuis selectedFilters", () => {
    const out = computeUrlFromFilters(
      new URLSearchParams(),
      { typologies: ["fablab", "coworking"] },
      {},
      [TYPO],
    );
    expect(out.get("typologies")).toBe("fablab,coworking");
  });

  it("sérialise un entityList depuis searchByFields (nom d'option)", () => {
    const sbf: Record<string, SearchByFieldValue> = {
      laRosee: { field: "sourceKey", type: "sourceKey", value: ["laRosee"] },
    };
    const out = computeUrlFromFilters(new URLSearchParams(), {}, sbf, [RESEAUX]);
    expect(out.get("reseauxRegionaux")).toBe("laRosee");
  });

  it("supprime le param quand la sélection est vide", () => {
    const out = computeUrlFromFilters(
      new URLSearchParams("typologies=fablab&page=2"),
      {},
      {},
      [TYPO],
    );
    expect(out.has("typologies")).toBe(false);
    // préserve les params hors filtres
    expect(out.get("page")).toBe("2");
  });

  it("NE touche PAS au param entityList tant que les options ne sont pas chargées", () => {
    const groupNoOptions: FilterGroupLike = { ...RESEAUX, options: [] };
    const out = computeUrlFromFilters(
      new URLSearchParams("reseauxRegionaux=laRosee"),
      {},
      {},
      [groupNoOptions],
    );
    // deep-link préservé (sinon il serait effacé avant l'hydratation)
    expect(out.get("reseauxRegionaux")).toBe("laRosee");
  });

  it("sérialise un scopeList depuis searchByFields (nom d'option)", () => {
    const out = computeUrlFromFilters(
      new URLSearchParams(),
      {},
      { "974": scopeEntry("974", "level3") },
      [REGIONS],
    );
    expect(out.get("regions")).toBe("974");
  });

  it("NE touche PAS au param scopeList tant que les options (zones) ne sont pas chargées", () => {
    const groupNoOptions: FilterGroupLike = { ...REGIONS, options: [] };
    const out = computeUrlFromFilters(
      new URLSearchParams("regions=974"),
      {},
      {},
      [groupNoOptions],
    );
    expect(out.get("regions")).toBe("974");
  });

  it("sérialise la recherche texte en ?search= (et la retire si vide)", () => {
    const set = computeUrlFromFilters(new URLSearchParams(), {}, {}, [], "tiers lieux");
    expect(set.get("search")).toBe("tiers lieux");
    const cleared = computeUrlFromFilters(new URLSearchParams("search=tiers"), {}, {}, [], "  ");
    expect(cleared.has("search")).toBe(false);
  });

  // — Point fixe : write puis read reproduit l'état d'origine (managed) —
  it("round-trip category : computeFiltersFromUrl(write(state)) == state", () => {
    const selected = { typologies: ["fablab", "coworking"] };
    const url = computeUrlFromFilters(new URLSearchParams(), selected, {}, [TYPO]);
    const { applySelected } = computeFiltersFromUrl(url, [TYPO], null);
    expect(applySelected({})).toEqual(selected);
  });

  it("round-trip entityList : computeFiltersFromUrl(write(state)) == state", () => {
    const sbf: Record<string, SearchByFieldValue> = {
      laRosee: { field: "sourceKey", type: "sourceKey", value: ["laRosee"] },
    };
    const url = computeUrlFromFilters(new URLSearchParams(), {}, sbf, [RESEAUX]);
    const { applySearchFields } = computeFiltersFromUrl(url, [RESEAUX], null);
    expect(applySearchFields({})).toEqual(sbf);
  });

  it("sérialise un filtre « par réponses » (service) depuis searchByFields", () => {
    const answerData = {
      services: { values: { garderie: { name: "Garderie", orgaNameArray: ["orgA", "orgB"] } } },
    };
    const out = computeUrlFromFilters(
      new URLSearchParams(),
      {},
      { garderie: { field: "_id", value: ["orgA", "orgB"] } },
      [],
      "",
      answerData,
    );
    expect(out.get("services")).toBe("garderie");
  });

  it("round-trip « par réponses » : computeFiltersFromUrl(write(state)) == state", () => {
    const answerData = {
      services: { values: { garderie: { name: "Garderie", orgaNameArray: ["orgA", "orgB"] } } },
    };
    const sbf: Record<string, SearchByFieldValue> = {
      garderie: { field: "_id", value: ["orgA", "orgB"] },
    };
    const url = computeUrlFromFilters(new URLSearchParams(), {}, sbf, [], "", answerData);
    const { applySearchFields } = computeFiltersFromUrl(url, [], answerData);
    expect(applySearchFields({})).toEqual(sbf);
  });

  it("round-trip scopeList : computeFiltersFromUrl(write(state)) == state", () => {
    const sbf: Record<string, SearchByFieldValue> = { "974": scopeEntry("974", "level3") };
    const url = computeUrlFromFilters(new URLSearchParams(), {}, sbf, [REGIONS]);
    const { applySearchFields } = computeFiltersFromUrl(url, [REGIONS], null);
    expect(applySearchFields({})).toEqual(sbf);
  });

  it("round-trip mixte stable (texte + tag + entityList + scopeList) + préserve un param libre (page)", () => {
    const selected = { typologies: ["fablab"] };
    const sbf: Record<string, SearchByFieldValue> = {
      laRosee: { field: "sourceKey", type: "sourceKey", value: ["laRosee"] },
      "974": scopeEntry("974", "level3"),
    };
    const groups = [TYPO, RESEAUX, REGIONS];
    const url = computeUrlFromFilters(new URLSearchParams("page=2"), selected, sbf, groups, "tiers");
    expect(url.get("page")).toBe("2"); // param hors filtres préservé
    expect(url.get("search")).toBe("tiers");
    const { applySelected, applySearchFields } = computeFiltersFromUrl(url, groups, null);
    expect(applySelected({})).toEqual(selected);
    expect(applySearchFields({})).toEqual(sbf);
    // Idempotence : ré-écrire depuis l'état relu ne change pas l'URL.
    const url2 = computeUrlFromFilters(url, applySelected({}), applySearchFields({}), groups, "tiers");
    expect(url2.toString()).toBe(url.toString());
  });
});

// ─── searchTargets (filtre « type d'info », CDC parents62) ──────────────────
const TYPE_INFO: FilterGroupLike = {
  id: "typeInfo",
  type: "searchTargets",
  options: [
    { id: "typeinfo-actions", name: "typeinfo-actions", target: { defaultTypes: ["projects"] } },
    {
      id: "typeinfo-paroles",
      name: "typeinfo-paroles",
      target: { defaultTypes: ["poi"], defaultFilters: { type: "affiche" } },
    },
  ],
};
const targetEntry = (target: Record<string, unknown>) =>
  ({ field: "searchTarget", type: "searchTarget", value: target }) as unknown as SearchByFieldValue;

describe("searchTargets — miroir URL", () => {
  it("écriture : option active dans searchByFields → ?typeInfo=<option>", () => {
    const out = computeUrlFromFilters(
      new URLSearchParams(),
      {},
      { "typeinfo-paroles": targetEntry({ defaultTypes: ["poi"] }) },
      [TYPE_INFO],
    );
    expect(out.get("typeInfo")).toBe("typeinfo-paroles");
  });

  it("écriture : aucune option active → param retiré", () => {
    const out = computeUrlFromFilters(
      new URLSearchParams("typeInfo=typeinfo-paroles"),
      {},
      {},
      [TYPE_INFO],
    );
    expect(out.get("typeInfo")).toBeNull();
  });

  it("lecture : deep-link ?typeInfo=… → entrée searchByFields avec la cible de l'option (radio : 1ʳᵉ valeur)", () => {
    const { applySearchFields } = computeFiltersFromUrl(
      new URLSearchParams("typeInfo=typeinfo-paroles,typeinfo-actions"),
      [TYPE_INFO],
      null,
    );
    expect(applySearchFields({})).toEqual({
      "typeinfo-paroles": {
        field: "searchTarget",
        type: "searchTarget",
        value: { defaultTypes: ["poi"], defaultFilters: { type: "affiche" } },
      },
    });
  });

  it("lecture : les clés d'options searchTargets sont reconstruites (pas préservées), les autres clés le sont", () => {
    const { applySearchFields } = computeFiltersFromUrl(new URLSearchParams(), [TYPE_INFO], null);
    const prev = {
      "typeinfo-actions": targetEntry({ defaultTypes: ["projects"] }),
      autre: { field: "tags", value: ["sport"] } as unknown as SearchByFieldValue,
    };
    expect(applySearchFields(prev)).toEqual({
      autre: { field: "tags", value: ["sport"] },
    });
  });
});

// ─── dateRange (filtre par date, CDC parents62) ─────────────────────────────
const DATES: FilterGroupLike = { id: "dates", type: "dateRange", field: "startDate" };
const rangeEntry = (value: Record<string, unknown>) =>
  ({ field: "startDate", type: "dateRange", value }) as unknown as SearchByFieldValue;

describe("dateRange — miroir URL", () => {
  it("écriture : plage active → ?dates=start[,end] ; vide → param retiré", () => {
    const out = computeUrlFromFilters(
      new URLSearchParams(),
      {},
      { dates: rangeEntry({ start: "2026-07-01", end: "2026-08-31" }) },
      [DATES],
    );
    expect(out.get("dates")).toBe("2026-07-01,2026-08-31");

    const cleared = computeUrlFromFilters(new URLSearchParams("dates=2026-07-01"), {}, {}, [DATES]);
    expect(cleared.get("dates")).toBeNull();
  });

  it("lecture : deep-link ?dates=start,end → entrée searchByFields sous la clé du groupe", () => {
    const { applySearchFields } = computeFiltersFromUrl(
      new URLSearchParams("dates=2026-07-01,2026-08-31"),
      [DATES],
      null,
    );
    expect(applySearchFields({})).toEqual({
      dates: { field: "startDate", type: "dateRange", value: { start: "2026-07-01", end: "2026-08-31" } },
    });
  });
});
