import { describe, it, expect } from "vitest";
import { buildSearchPayload } from "./buildSearchPayload";

/**
 * Garde-fou du bug SSR≠client : le SSR (`prefetchSearchResults`) et le client
 * (`useSearchQuery`) doivent passer EXACTEMENT le même payload à `searchCostum`.
 * Les deux passent désormais par `buildSearchPayload` ; ces tests verrouillent
 * que les params de SCOPE (sourceKey, costumSlug, contextId…) sont bien
 * transportés — c'est leur omission côté SSR qui causait des résultats
 * différents (ex. events scopés par sourceKey uniquement côté client).
 */

const overrides = { name: "", type: ["events"] as string[] };

describe("buildSearchPayload — params de scope (parité SSR/client)", () => {
  it("transporte sourceKey depuis les baseParams", () => {
    const p = buildSearchPayload(
      { sourceKey: ["franceTierslieux", "tierslieuxbelgique"] } as never,
      overrides,
    );
    expect(p.sourceKey).toEqual(["franceTierslieux", "tierslieuxbelgique"]);
  });

  it("transporte costumSlug / contextId / contextType / costumEditMode", () => {
    const p = buildSearchPayload(
      { costumSlug: "tiersLieux", contextId: "abc", contextType: "organizations", costumEditMode: false } as never,
      overrides,
    ) as Record<string, unknown>;
    expect(p.costumSlug).toBe("tiersLieux");
    expect(p.contextId).toBe("abc");
    expect(p.contextType).toBe("organizations");
    expect(p.costumEditMode).toBe(false);
  });

  it("transporte defaultSortBy → sortBy (tri events par startDate)", () => {
    const p = buildSearchPayload({ defaultSortBy: { startDate: 1 } }, overrides);
    expect(p.sortBy).toEqual({ startDate: 1 });
  });

  it("retombe sur defaultTypes quand aucun type explicite n'est fourni", () => {
    const p = buildSearchPayload({ defaultTypes: ["events"] }, { name: "" });
    expect(p.searchType).toEqual(["events"]);
  });

  it("n'ajoute pas sourceKey si absent des baseParams", () => {
    const p = buildSearchPayload({ defaultTypes: ["events"] }, overrides) as Record<string, unknown>;
    expect("sourceKey" in p).toBe(false);
  });
});

describe("buildSearchPayload — mode carte (chargement progressif)", () => {
  it("mapUsed : pages de 500 par défaut (paginées par le paginator SDK)", () => {
    const p = buildSearchPayload({}, { ...overrides, mapUsed: true });
    expect(p).toMatchObject({ mapUsed: true, indexMin: 0, indexStep: 500 });
  });

  it("indexStepMap: 0 en config restaure le tout-en-1-appel (legacy)", () => {
    const p = buildSearchPayload({ indexStepMap: 0 }, { ...overrides, mapUsed: true });
    expect(p).toMatchObject({ mapUsed: true, indexMin: 0, indexStep: 0 });
  });

  it("indexStepMap personnalisé respecté", () => {
    const p = buildSearchPayload({ indexStepMap: 250 }, { ...overrides, mapUsed: true });
    expect(p).toMatchObject({ indexStep: 250 });
  });
});
