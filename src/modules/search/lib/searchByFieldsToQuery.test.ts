import { describe, it, expect } from "vitest";
import { searchByFieldsToQuery } from "./searchByFieldsToQuery";

import type { SearchByFieldValue } from "../contexts/pageFilters";

const entry = (v: Record<string, unknown>) => v as unknown as SearchByFieldValue;

describe("searchByFieldsToQuery", () => {
  it("champ simple → filters { field: { $in } } (fusion multi-entrées, dédupliquée)", () => {
    const out = searchByFieldsToQuery({
      a: entry({ field: "services", value: ["s1", "s2"] }),
      b: entry({ field: "services", value: ["s2", "s3"] }),
    });
    expect(out.filters).toEqual({ services: { $in: ["s1", "s2", "s3"] } });
    expect(out.searchTarget).toBeNull();
  });

  it("scopeList → locality ; sourceKey → sourceKeys", () => {
    const out = searchByFieldsToQuery({
      z1: entry({ field: "974level3", type: "scopeList", value: { id: "974", type: "level3" } }),
      e1: entry({ field: "sourceKey", type: "sourceKey", value: ["laRosee"] }),
    });
    expect(out.locality).toEqual({ "974level3": { id: "974", type: "level3" } });
    expect(out.sourceKeys).toEqual(["laRosee"]);
    expect(out.filters).toEqual({});
  });

  it("searchTarget (« type d'info ») : porté séparément, PAS dans filters", () => {
    const target = { defaultTypes: ["poi"], defaultFilters: { type: "affiche" } };
    const out = searchByFieldsToQuery({
      "typeinfo-paroles": entry({ field: "searchTarget", type: "searchTarget", value: target }),
      autre: entry({ field: "tags", value: ["sport"] }),
    });
    expect(out.searchTarget).toEqual(target);
    expect(out.filters).toEqual({ tags: { $in: ["sport"] } });
  });

  it("dateRange : début → $gt (seul opérateur date converti par le backend) ; fin → $lte si présente", () => {
    const out = searchByFieldsToQuery({
      dates: entry({ field: "startDate", type: "dateRange", value: { start: "2026-07-01" } }),
    });
    expect(out.filters).toEqual({ startDate: { $gt: "2026-07-01" } });

    const both = searchByFieldsToQuery({
      dates: entry({ field: "startDate", type: "dateRange", value: { start: "2026-07-01", end: "2026-08-31" } }),
    });
    expect(both.filters).toEqual({ startDate: { $gt: "2026-07-01", $lte: "2026-08-31" } });
  });

  it("entrée vide → sorties vides et searchTarget null", () => {
    expect(searchByFieldsToQuery({})).toEqual({
      filters: {},
      locality: {},
      sourceKeys: [],
      searchTarget: null,
    });
  });
});
