import { describe, expect, it } from "vitest";
import config from "../../config.prod.tierslieuxbelgique.json";
import { buildSearchPayload } from "@/modules/search/lib/buildSearchPayload";
import { computeFiltersFromUrl } from "@/modules/search/lib/computeFiltersFromUrl";
import { computeUrlFromFilters } from "@/modules/search/lib/computeUrlFromFilters";

const page = config.pages.find((entry) => entry.path === "/annuaire");
const grid = page?.sections.find((section) => section.type === "gridLayout");
if (!grid || !("leftSection" in grid.props)) throw new Error("Filtres de l'annuaire absents");
const groups = grid.props.leftSection.props.filterGroups;

describe("filtres de l'annuaire belge", () => {
  it("propose les sept groupes de la cartographie sans filtre actif par défaut", () => {
    expect(groups.map((group) => group.id)).toEqual([
      "typePlace", "networks", "enjeux", "siteEnvironment", "manageModel",
      "commonTransportsAccess", "vehiculesAccess",
    ]);
    expect(groups.map((group) => group.options.length)).toEqual([23, 9, 10, 4, 9, 4, 3]);
    expect(computeFiltersFromUrl(new URLSearchParams(), groups, null).applySelected({})).toEqual({});
  });

  it("conserve les valeurs exactes, même avec virgule, au rechargement et à la recherche", () => {
    const selected = {
      enjeux: ["Santé"],
      siteEnvironment: ["En périphérie, décentré"],
    };
    const params = computeUrlFromFilters(new URLSearchParams("q=lieu"), selected, {}, groups);
    const restored = computeFiltersFromUrl(new URLSearchParams(params.toString()), groups, null);
    expect(restored.applySelected({})).toEqual(selected);
    expect(params.get("q")).toBe("lieu");
    const payload = buildSearchPayload({}, { name: "", tags: Object.values(selected).flat() });
    expect(payload.searchTags).toEqual(["Santé", "En périphérie, décentré"]);
    expect(payload.options).toEqual({ tags: { verb: "$all" } });
    expect(computeUrlFromFilters(params, {}, {}, groups).toString()).toBe("q=lieu");
  });
});
