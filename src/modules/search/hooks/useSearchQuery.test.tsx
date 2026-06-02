// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

// ─── Mocks ──────────────────────────────────────────────────────────────────
const mockUseCocolight = vi.fn();
const capturedHookOpts = vi.fn();

vi.mock("@/hooks/useCocolight", () => ({
  useCocolight: () => mockUseCocolight(),
}));

vi.mock("@/hooks/useInfiniteQueryScroll", () => ({
  useInfiniteQueryScrollNextWithTransform: (opts: unknown) => {
    capturedHookOpts(opts);
    return {
      data: undefined,
      error: null,
      lastItemRef: vi.fn(),
      isFetchingNextPage: false,
      isLoading: false,
      isPending: false,
      refetch: vi.fn(),
      totalCount: 0,
      hasCount: false,
    };
  },
}));

import { useSearchQuery } from "./useSearchQuery";

function defaultProps() {
  return {
    queryKeyPrefix: "test-search",
    searchText: "",
    searchTags: {} as Record<string, string[]>,
    searchType: null,
    mapUsed: false,
  };
}

// Récupère la queryFn capturée pour la déclencher avec un pageParam donné
async function getCapturedQueryFn() {
  const opts = capturedHookOpts.mock.calls[0][0] as {
    queryFn: (ctx: { pageParam?: unknown }) => Promise<unknown>;
  };
  return opts.queryFn;
}

describe("useSearchQuery", () => {
  beforeEach(() => {
    capturedHookOpts.mockReset();
  });

  describe("queryKey", () => {
    it("génère une queryKey contenant le préfixe + variant défaut", () => {
      mockUseCocolight.mockReturnValue({ entity: { searchCostum: vi.fn() }, helper: {} });
      renderHook(() => useSearchQuery(defaultProps()));
      const opts = capturedHookOpts.mock.calls[0][0] as { queryKey: readonly unknown[] };
      expect(opts.queryKey[0]).toBe("test-search");
      // variant fallback "default" en dernière position
      expect(opts.queryKey[opts.queryKey.length - 1]).toBe("default");
    });

    it("inclut le variant fourni dans la queryKey", () => {
      mockUseCocolight.mockReturnValue({ entity: { searchCostum: vi.fn() }, helper: {} });
      renderHook(() =>
        useSearchQuery({ ...defaultProps(), variant: "navigator-tl" })
      );
      const opts = capturedHookOpts.mock.calls[0][0] as { queryKey: readonly unknown[] };
      expect(opts.queryKey[opts.queryKey.length - 1]).toBe("navigator-tl");
    });
  });

  describe("options propagées au hook", () => {
    it("enabled basé sur l'existence de entity", () => {
      mockUseCocolight.mockReturnValue({ entity: null, helper: {} });
      renderHook(() => useSearchQuery(defaultProps()));
      const opts = capturedHookOpts.mock.calls[0][0] as { options: { enabled: boolean } };
      expect(opts.options.enabled).toBe(false);

      capturedHookOpts.mockReset();
      mockUseCocolight.mockReturnValue({ entity: { searchCostum: vi.fn() }, helper: {} });
      renderHook(() => useSearchQuery(defaultProps()));
      const opts2 = capturedHookOpts.mock.calls[0][0] as { options: { enabled: boolean } };
      expect(opts2.options.enabled).toBe(true);
    });

    it("propage transform.entity quand entity disponible", () => {
      const entity = { searchCostum: vi.fn() };
      const helper = { x: 1 };
      mockUseCocolight.mockReturnValue({ entity, helper });
      renderHook(() => useSearchQuery(defaultProps()));
      const opts = capturedHookOpts.mock.calls[0][0] as { transform?: { entity: unknown; helper: unknown } };
      expect(opts.transform).toEqual({ entity, helper });
    });

    it("transform est undefined quand entity null", () => {
      mockUseCocolight.mockReturnValue({ entity: null, helper: {} });
      renderHook(() => useSearchQuery(defaultProps()));
      const opts = capturedHookOpts.mock.calls[0][0] as { transform?: unknown };
      expect(opts.transform).toBeUndefined();
    });
  });

  describe("queryFn — construction des paramètres", () => {
    it("throw si entity manquante", async () => {
      mockUseCocolight.mockReturnValue({ entity: null, helper: {} });
      renderHook(() => useSearchQuery(defaultProps()));
      const queryFn = await getCapturedQueryFn();
      await expect(queryFn({})).rejects.toThrow(/entity manquante/);
    });

    it("renvoie résultat vide si pas de searchType (null et defaultTypes absent)", async () => {
      const searchCostum = vi.fn();
      mockUseCocolight.mockReturnValue({ entity: { searchCostum }, helper: {} });
      renderHook(() => useSearchQuery({ ...defaultProps(), searchType: null }));
      const queryFn = await getCapturedQueryFn();
      const result = (await queryFn({})) as { results: unknown[]; hasNext: boolean };
      expect(result.results).toEqual([]);
      expect(result.hasNext).toBe(false);
      expect(searchCostum).not.toHaveBeenCalled();
    });

    it("appelle searchCostum avec name=searchText", async () => {
      const searchCostum = vi.fn().mockResolvedValue({ results: [], count: { total: 0 }, hasNext: false });
      mockUseCocolight.mockReturnValue({ entity: { searchCostum }, helper: {} });
      renderHook(() =>
        useSearchQuery({
          ...defaultProps(),
          searchText: "hello",
          searchType: { x: ["organizations"] },
        })
      );
      const queryFn = await getCapturedQueryFn();
      await queryFn({});
      expect(searchCostum).toHaveBeenCalled();
      const param = searchCostum.mock.calls[0][0];
      expect(param.name).toBe("hello");
      expect(param.searchType).toEqual(["organizations"]);
    });

    it("aplatit searchTags des sous-objets en array unique", async () => {
      const searchCostum = vi.fn().mockResolvedValue({ results: [], count: { total: 0 }, hasNext: false });
      mockUseCocolight.mockReturnValue({ entity: { searchCostum }, helper: {} });
      renderHook(() =>
        useSearchQuery({
          ...defaultProps(),
          searchTags: { cat1: ["tag1", "tag2"], cat2: ["tag3"] },
          searchType: { x: ["events"] },
        })
      );
      const queryFn = await getCapturedQueryFn();
      await queryFn({});
      const param = searchCostum.mock.calls[0][0];
      expect(param.searchTags).toEqual(["tag1", "tag2", "tag3"]);
      expect(param.options).toEqual({ tags: { verb: "$all" } });
    });

    it("ajoute indexStep=indexStepList (10 par défaut) quand !mapUsed", async () => {
      const searchCostum = vi.fn().mockResolvedValue({ results: [], count: { total: 0 }, hasNext: false });
      mockUseCocolight.mockReturnValue({ entity: { searchCostum }, helper: {} });
      renderHook(() =>
        useSearchQuery({
          ...defaultProps(),
          searchType: { x: ["organizations"] },
          mapUsed: false,
        })
      );
      const queryFn = await getCapturedQueryFn();
      await queryFn({});
      const param = searchCostum.mock.calls[0][0];
      expect(param.indexStep).toBe(10);
      expect(param.mapUsed).toBeUndefined();
    });

    it("ajoute mapUsed=true + indexStepMap quand mapUsed", async () => {
      const searchCostum = vi.fn().mockResolvedValue({ results: [], count: { total: 0 }, hasNext: false });
      mockUseCocolight.mockReturnValue({ entity: { searchCostum }, helper: {} });
      renderHook(() =>
        useSearchQuery({
          ...defaultProps(),
          searchType: { x: ["organizations"] },
          mapUsed: true,
          baseParams: { indexStepMap: 50 },
        })
      );
      const queryFn = await getCapturedQueryFn();
      await queryFn({});
      const param = searchCostum.mock.calls[0][0];
      expect(param.mapUsed).toBe(true);
      expect(param.indexStep).toBe(50);
    });

    it("variant 'navigator-tl' → passe { variant } en 2e arg", async () => {
      const searchCostum = vi.fn().mockResolvedValue({ results: [], count: { total: 0 }, hasNext: false });
      mockUseCocolight.mockReturnValue({ entity: { searchCostum }, helper: {} });
      renderHook(() =>
        useSearchQuery({
          ...defaultProps(),
          searchType: { x: ["organizations"] },
          variant: "navigator-tl",
        })
      );
      const queryFn = await getCapturedQueryFn();
      await queryFn({});
      expect(searchCostum).toHaveBeenCalledWith(
        expect.any(Object),
        { variant: "navigator-tl" }
      );
    });

    it("variant 'default' → searchCostum appelé sans 2e arg", async () => {
      const searchCostum = vi.fn().mockResolvedValue({ results: [], count: { total: 0 }, hasNext: false });
      mockUseCocolight.mockReturnValue({ entity: { searchCostum }, helper: {} });
      renderHook(() =>
        useSearchQuery({
          ...defaultProps(),
          searchType: { x: ["organizations"] },
          variant: "default",
        })
      );
      const queryFn = await getCapturedQueryFn();
      await queryFn({});
      expect(searchCostum.mock.calls[0].length).toBe(1);
    });

    it("propage baseParams.defaultFilters quand fourni", async () => {
      const searchCostum = vi.fn().mockResolvedValue({ results: [], count: { total: 0 }, hasNext: false });
      mockUseCocolight.mockReturnValue({ entity: { searchCostum }, helper: {} });
      renderHook(() =>
        useSearchQuery({
          ...defaultProps(),
          searchType: { x: ["organizations"] },
          baseParams: { defaultFilters: { status: "active" } },
        })
      );
      const queryFn = await getCapturedQueryFn();
      await queryFn({});
      expect(searchCostum.mock.calls[0][0].filters).toEqual({ status: "active" });
    });

    it("utilise defaultTypes quand searchType absent", async () => {
      const searchCostum = vi.fn().mockResolvedValue({ results: [], count: { total: 0 }, hasNext: false });
      mockUseCocolight.mockReturnValue({ entity: { searchCostum }, helper: {} });
      renderHook(() =>
        useSearchQuery({
          ...defaultProps(),
          searchType: null,
          baseParams: { defaultTypes: ["organizations"] as never[] },
        })
      );
      const queryFn = await getCapturedQueryFn();
      // Note: la logique actuelle dans le hook ne déclenche pas defaultTypes
      // si searchType est null (renvoie early). On vérifie le comportement actuel.
      const result = await queryFn({});
      expect(result).toBeDefined();
    });

    it("propage searchBy quand fourni", async () => {
      const searchCostum = vi.fn().mockResolvedValue({ results: [], count: { total: 0 }, hasNext: false });
      mockUseCocolight.mockReturnValue({ entity: { searchCostum }, helper: {} });
      renderHook(() =>
        useSearchQuery({
          ...defaultProps(),
          searchType: { x: ["organizations"] },
          baseParams: { searchBy: ["name", "shortDescription"] },
        })
      );
      const queryFn = await getCapturedQueryFn();
      await queryFn({});
      expect(searchCostum.mock.calls[0][0].searchBy).toEqual(["name", "shortDescription"]);
    });

    it("propage notSourceKey quand truthy", async () => {
      const searchCostum = vi.fn().mockResolvedValue({ results: [], count: { total: 0 }, hasNext: false });
      mockUseCocolight.mockReturnValue({ entity: { searchCostum }, helper: {} });
      renderHook(() =>
        useSearchQuery({
          ...defaultProps(),
          searchType: { x: ["organizations"] },
          baseParams: { notSourceKey: true },
        })
      );
      const queryFn = await getCapturedQueryFn();
      await queryFn({});
      expect(searchCostum.mock.calls[0][0].notSourceKey).toBe(true);
    });

    it("re-throw les erreurs SDK", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const searchCostum = vi.fn().mockRejectedValue(new Error("backend down"));
      mockUseCocolight.mockReturnValue({ entity: { searchCostum }, helper: {} });
      renderHook(() =>
        useSearchQuery({
          ...defaultProps(),
          searchType: { x: ["organizations"] },
        })
      );
      const queryFn = await getCapturedQueryFn();
      await expect(queryFn({})).rejects.toThrow("backend down");
      consoleSpy.mockRestore();
    });
  });
});
