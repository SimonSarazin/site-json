import { describe, it, expect, vi } from "vitest";
import { fetchResourceIdsInPerimeter, searchCostumEach, searchCostumIds, type PoiSearchHost } from "./useResourcesInPerimeterQuery";

const page = (ids: string[], next?: Record<string, unknown>) => ({
  results: ids.map((id) => ({ id })),
  hasNext: Boolean(next),
  next: () => Promise.resolve(next),
});
const host = (mock: ReturnType<typeof vi.fn>) => ({ searchCostum: mock }) as unknown as PoiSearchHost;

describe("searchCostumEach — chaque résultat d'une recherche, pages suivies", () => {
  it("remet chaque résultat, page après page ; les champs du demandeur remplacent le défaut", async () => {
    const search = vi.fn().mockResolvedValue(page(["o1"], page(["o2"])));
    const vus: unknown[] = [];
    await searchCostumEach(host(search), { fields: ["collection", "type"] }, (r) => vus.push(r));
    expect(vus).toEqual([{ id: "o1" }, { id: "o2" }]);
    expect(search.mock.calls[0][0]).toMatchObject({ name: "", indexMin: 0, fields: ["collection", "type"] });
  });
});

describe("searchCostumIds — identifiants d'une recherche scopée au costum du site", () => {
  it("garde `fields: [\"collection\"]` sous les paramètres du demandeur, suit les pages, sans sourceKey imposé", async () => {
    const search = vi.fn().mockResolvedValue(page(["o1"], page(["o2"])));
    expect([...(await searchCostumIds(host(search), { searchType: ["organizations"] }))]).toEqual(["o1", "o2"]);
    const params = search.mock.calls[0][0];
    expect(params).toMatchObject({ name: "", indexMin: 0, fields: ["collection"], searchType: ["organizations"] });
    // Pas de sourceKey : le SDK injecte celui du site.
    expect(params).not.toHaveProperty("sourceKey");
  });
});

describe("fetchResourceIdsInPerimeter — équipements d'un périmètre", () => {
  it("un seul appel `_id: {$in}` (trié, sans doublon) + les filtres du périmètre, scopé au costum du site", async () => {
    const search = vi.fn().mockResolvedValue(page(["b"]));
    const r = await fetchResourceIdsInPerimeter(host(search), ["c", "b", "c"], { poiFilters: { type: "recoveryCenter" } });
    expect(r).toEqual(["b"]);
    const params = search.mock.calls[0][0];
    expect(params).toMatchObject({ searchType: ["poi"], filters: { type: "recoveryCenter", _id: { $in: ["b", "c"] } } });
    // Pas de sourceKey : le SDK injecte celui du site.
    expect(params).not.toHaveProperty("sourceKey");
  });

  it("transmet un sourceKey explicite (équipements sous un autre costum)", async () => {
    const search = vi.fn().mockResolvedValue(page([]));
    await fetchResourceIdsInPerimeter(host(search), ["a"], { poiFilters: {}, sourceKey: ["autreCostum"] });
    expect(search.mock.calls[0][0]).toMatchObject({ sourceKey: ["autreCostum"] });
  });

  it("suit les pages suivantes", async () => {
    const search = vi.fn().mockResolvedValue(page(["a"], page(["b"])));
    expect(await fetchResourceIdsInPerimeter(host(search), ["a", "b", "z"], { poiFilters: {} })).toEqual(["a", "b"]);
  });

  it("aucun identifiant → AUCUN appel (le backend ignorerait le `$in` vide et rendrait tout)", async () => {
    const search = vi.fn();
    expect(await fetchResourceIdsInPerimeter(host(search), [], { poiFilters: {} })).toEqual([]);
    expect(search).not.toHaveBeenCalled();
  });
});
