import { describe, it, expect, vi } from "vitest";
import { transformToEntityInstance, restorePaginationFromJSON } from "../entityTransform";

/**
 * Tests de entityTransform :
 *  - transformToEntityInstance : passthrough si instance, sinon helper.fromEntityJSON, fallback si throw
 *  - restorePaginationFromJSON : passthrough si déjà restaurée, sinon helper.restorePaginationFromJSON, fallback si throw
 */

// Mocks minimaux : on ne dépend pas du vrai SDK Cocolight ici.
function makeHelper(overrides: Partial<{ fromEntityJSON: ReturnType<typeof vi.fn>; restorePaginationFromJSON: ReturnType<typeof vi.fn> }> = {}) {
  return {
    fromEntityJSON: overrides.fromEntityJSON ?? vi.fn((json: unknown) => ({ wrapped: json })),
    restorePaginationFromJSON:
      overrides.restorePaginationFromJSON ??
      vi.fn((page: unknown) => ({ restored: page })),
  } as unknown as Parameters<typeof transformToEntityInstance>[1];
}

function makeParent() {
  return { id: "parent", getEntityType: () => "organizations" } as unknown as Parameters<
    typeof transformToEntityInstance
  >[2];
}

describe("transformToEntityInstance", () => {
  it("retourne l'item tel quel si déjà instance (a getEntityType)", () => {
    const instance = { id: "x", getEntityType: () => "citoyens", foo: "bar" };
    const helper = makeHelper();
    const parent = makeParent();

    const result = transformToEntityInstance(instance, helper, parent);

    expect(result).toBe(instance);
    expect((helper as unknown as { fromEntityJSON: { mock: { calls: unknown[][] } } }).fromEntityJSON.mock.calls.length).toBe(0);
  });

  it("appelle helper.fromEntityJSON si item est un JSON brut", () => {
    const json = { id: "y", name: "Y" };
    const helper = makeHelper();
    const parent = makeParent();

    const result = transformToEntityInstance(json, helper, parent);

    expect(result).toEqual({ wrapped: json });
    const fromEntityJSON = (helper as unknown as { fromEntityJSON: { mock: { calls: unknown[][] } } }).fromEntityJSON;
    expect(fromEntityJSON.mock.calls.length).toBe(1);
    expect(fromEntityJSON.mock.calls[0][0]).toBe(json);
    expect(fromEntityJSON.mock.calls[0][1]).toBe(parent);
  });

  it("retourne l'item brut si helper.fromEntityJSON throw (fallback safe)", () => {
    const json = { id: "z" };
    const helper = makeHelper({
      fromEntityJSON: vi.fn(() => {
        throw new Error("boom");
      }),
    });
    const parent = makeParent();

    const result = transformToEntityInstance(json, helper, parent);

    expect(result).toBe(json);
  });

  it("retourne null/primitives tels quels via helper", () => {
    const helper = makeHelper();
    const parent = makeParent();

    // null n'a pas getEntityType → passe par helper qui wrap
    const result = transformToEntityInstance(null, helper, parent);
    expect(result).toEqual({ wrapped: null });
  });
});

describe("restorePaginationFromJSON", () => {
  it("retourne la page telle quelle si déjà restaurée (page._entity.getEntityType présent)", () => {
    const page = {
      data: [],
      _entity: { getEntityType: () => "organizations" },
    };
    const helper = makeHelper();
    const parent = makeParent();

    const result = restorePaginationFromJSON(page, helper, parent);

    expect(result).toBe(page);
    const restorePaginationFromJSONMock = (helper as unknown as { restorePaginationFromJSON: { mock: { calls: unknown[][] } } }).restorePaginationFromJSON;
    expect(restorePaginationFromJSONMock.mock.calls.length).toBe(0);
  });

  it("appelle helper.restorePaginationFromJSON si page brute (sans _entity)", () => {
    const page = { data: [{ id: "1" }] };
    const helper = makeHelper();
    const parent = makeParent();

    const result = restorePaginationFromJSON(page, helper, parent);

    expect(result).toEqual({ restored: page });
    const restorePaginationFromJSONMock = (helper as unknown as { restorePaginationFromJSON: { mock: { calls: unknown[][] } } }).restorePaginationFromJSON;
    expect(restorePaginationFromJSONMock.mock.calls.length).toBe(1);
    expect(restorePaginationFromJSONMock.mock.calls[0][0]).toBe(page);
    expect(restorePaginationFromJSONMock.mock.calls[0][1]).toBe(parent);
  });

  it("appelle helper si _entity est présent mais sans getEntityType", () => {
    const page = { data: [], _entity: { id: "raw" } };
    const helper = makeHelper();
    const parent = makeParent();

    const result = restorePaginationFromJSON(page, helper, parent);

    expect(result).toEqual({ restored: page });
  });

  it("retourne la page brute si helper.restorePaginationFromJSON throw", () => {
    const page = { data: [{ id: "1" }] };
    const helper = makeHelper({
      restorePaginationFromJSON: vi.fn(() => {
        throw new Error("boom");
      }),
    });
    const parent = makeParent();

    const result = restorePaginationFromJSON(page, helper, parent);

    expect(result).toBe(page);
  });
});
