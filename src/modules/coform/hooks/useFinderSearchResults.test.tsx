// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import type { FinderConfig, FinderElementType } from "../types";

// ─── Mocks ──────────────────────────────────────────────────────────────────
const searchCostumMock = vi.fn();
const fromEntityJSONMock = vi.fn();

const entityMock = {
  searchCostum: searchCostumMock,
};

const helperMock = {
  fromEntityJSON: fromEntityJSONMock,
};

vi.mock("@/hooks/useCocolight", () => ({
  useCocolight: () => ({ entity: entityMock, helper: helperMock }),
}));

import { useFinderSearchResults } from "./useFinderSearchResults";

// ─── Helpers ────────────────────────────────────────────────────────────────
function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

function makeConfig(overrides: Partial<FinderConfig> = {}): FinderConfig {
  return {
    type: "organizations" as FinderElementType,
    filters: [],
    notSourceKey: false,
    myContacts: false,
    initCurrentUser: false,
    elementLabel: "",
    buttonLabel: "",
    placeholderSearchField: "",
    field: "field",
    multiple: false,
    addNew: false,
    invite: false,
    linkToAnswer: false,
    singleAnswerPerElement: false,
    msgSingleAnswerPerElement: "",
    redirectSingleAnswerPerElement: "Accueil",
    editElement: false,
    addToLinks: { value: false, links: "" },
    ...overrides,
  };
}

/** Entité-instance SDK simulée (avec getEntityType + id + serverData). */
function makeSdkInstance(id: string, name: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    getEntityType: () => "organizations",
    serverData: { name, ...extra },
  };
}

// On utilise des vrais timers + délai réel pour le debounce (300ms) — fake timers
// posent problème avec waitFor de @testing-library qui poll en setTimeout.
const DEBOUNCE_DELAY_MS = 350;

// ─── Tests ──────────────────────────────────────────────────────────────────
describe("useFinderSearchResults", () => {
  beforeEach(() => {
    searchCostumMock.mockReset();
    fromEntityJSONMock.mockReset();
  });

  describe("enabled / disabled", () => {
    it("ne fetche pas si enabled=false", async () => {
      const { result } = renderHook(
        () => useFinderSearchResults({ query: "test", config: makeConfig(), enabled: false }),
        { wrapper: makeWrapper() }
      );
      await new Promise((r) => setTimeout(r, DEBOUNCE_DELAY_MS));
      expect(searchCostumMock).not.toHaveBeenCalled();
      expect(result.current.results).toEqual([]);
      expect(result.current.isFetching).toBe(false);
    });

    it("ne fetche pas si query < 2 caractères", async () => {
      renderHook(
        () => useFinderSearchResults({ query: "a", config: makeConfig(), enabled: true }),
        { wrapper: makeWrapper() }
      );
      await new Promise((r) => setTimeout(r, DEBOUNCE_DELAY_MS));
      expect(searchCostumMock).not.toHaveBeenCalled();
    });
  });

  describe("appel searchCostum", () => {
    it("appelle searchCostum après debounce avec les params attendus", async () => {
      searchCostumMock.mockResolvedValue({ results: [] });
      renderHook(
        () =>
          useFinderSearchResults({
            query: "marseille",
            config: makeConfig({ type: "organizations" }),
            enabled: true,
          }),
        { wrapper: makeWrapper() }
      );
      await waitFor(() => expect(searchCostumMock).toHaveBeenCalledTimes(1));
      const payload = searchCostumMock.mock.calls[0][0];
      expect(payload).toMatchObject({
        name: "marseille",
        searchType: ["organizations"],
        indexMin: 0,
        indexStep: 30,
      });
    });

    it("aplatit FinderFilter[] en objet { attributeName: valueName }", async () => {
      searchCostumMock.mockResolvedValue({ results: [] });
      renderHook(
        () =>
          useFinderSearchResults({
            query: "test1",
            config: makeConfig({
              filters: [
                { attributeName: "tags", valueName: "ess" },
                { attributeName: "country", valueName: "FR" },
              ],
            }),
            enabled: true,
          }),
        { wrapper: makeWrapper() }
      );
      await waitFor(() => expect(searchCostumMock).toHaveBeenCalledTimes(1));
      expect(searchCostumMock.mock.calls[0][0].filters).toEqual({
        tags: "ess",
        country: "FR",
      });
    });

    it("n'inclut PAS filters si liste vide", async () => {
      searchCostumMock.mockResolvedValue({ results: [] });
      renderHook(
        () => useFinderSearchResults({ query: "test2", config: makeConfig({ filters: [] }), enabled: true }),
        { wrapper: makeWrapper() }
      );
      await waitFor(() => expect(searchCostumMock).toHaveBeenCalledTimes(1));
      expect(searchCostumMock.mock.calls[0][0].filters).toBeUndefined();
    });

    it("inclut notSourceKey=true quand config.notSourceKey=true", async () => {
      searchCostumMock.mockResolvedValue({ results: [] });
      renderHook(
        () => useFinderSearchResults({ query: "test3", config: makeConfig({ notSourceKey: true }), enabled: true }),
        { wrapper: makeWrapper() }
      );
      await waitFor(() => expect(searchCostumMock).toHaveBeenCalledTimes(1));
      expect(searchCostumMock.mock.calls[0][0].notSourceKey).toBe(true);
    });

    it("n'inclut PAS notSourceKey si config.notSourceKey=false", async () => {
      searchCostumMock.mockResolvedValue({ results: [] });
      renderHook(
        () => useFinderSearchResults({ query: "test4", config: makeConfig({ notSourceKey: false }), enabled: true }),
        { wrapper: makeWrapper() }
      );
      await waitFor(() => expect(searchCostumMock).toHaveBeenCalledTimes(1));
      expect(searchCostumMock.mock.calls[0][0].notSourceKey).toBeUndefined();
    });
  });

  describe("transformation des résultats", () => {
    it("retourne FinderSearchResult[] pour instances SDK déjà transformées", async () => {
      searchCostumMock.mockResolvedValue({
        results: [
          makeSdkInstance("507f1f77bcf86cd799439011", "Org A", {
            collection: "organizations",
            profilThumbImageUrl: "https://api/a.jpg",
          }),
        ],
      });
      const { result } = renderHook(
        () => useFinderSearchResults({ query: "test5", config: makeConfig(), enabled: true }),
        { wrapper: makeWrapper() }
      );
      await waitFor(() => expect(result.current.results.length).toBe(1));
      expect(fromEntityJSONMock).not.toHaveBeenCalled();
      expect(result.current.results[0]).toMatchObject({
        id: "507f1f77bcf86cd799439011",
        name: "Org A",
        type: "organizations",
        profilThumbImageUrl: "https://api/a.jpg",
      });
    });

    it("appelle helper.fromEntityJSON pour les items JSON bruts", async () => {
      const sdkInstance = makeSdkInstance("xyz", "From JSON", { collection: "organizations" });
      fromEntityJSONMock.mockReturnValue(sdkInstance);
      searchCostumMock.mockResolvedValue({
        results: [{ _id: { $oid: "xyz" }, name: "From JSON" }], // JSON brut sans getEntityType
      });
      const { result } = renderHook(
        () => useFinderSearchResults({ query: "test6", config: makeConfig(), enabled: true }),
        { wrapper: makeWrapper() }
      );
      await waitFor(() => expect(result.current.results.length).toBe(1));
      expect(fromEntityJSONMock).toHaveBeenCalledTimes(1);
      expect(result.current.results[0].id).toBe("xyz");
      expect(result.current.results[0].name).toBe("From JSON");
    });

    it("supporte results sous forme objet { id: item }", async () => {
      searchCostumMock.mockResolvedValue({
        results: {
          k1: makeSdkInstance("id1", "Item 1"),
          k2: makeSdkInstance("id2", "Item 2"),
        },
      });
      const { result } = renderHook(
        () => useFinderSearchResults({ query: "test7", config: makeConfig(), enabled: true }),
        { wrapper: makeWrapper() }
      );
      await waitFor(() => expect(result.current.results.length).toBe(2));
      expect(result.current.results.map((r) => r.id)).toEqual(["id1", "id2"]);
    });

    it("filtre les items sans id (id vide ou null)", async () => {
      searchCostumMock.mockResolvedValue({
        results: [
          makeSdkInstance("id1", "Valid"),
          { id: null, getEntityType: () => "organizations", serverData: { name: "Orphan" } },
        ],
      });
      const { result } = renderHook(
        () => useFinderSearchResults({ query: "test8", config: makeConfig(), enabled: true }),
        { wrapper: makeWrapper() }
      );
      await waitFor(() => expect(result.current.results.length).toBe(1));
      expect(result.current.results[0].id).toBe("id1");
    });
  });

  describe("erreurs", () => {
    it("expose error si searchCostum throw", async () => {
      const err = new Error("network down");
      searchCostumMock.mockRejectedValue(err);
      const { result } = renderHook(
        () => useFinderSearchResults({ query: "test9", config: makeConfig(), enabled: true }),
        { wrapper: makeWrapper() }
      );
      await waitFor(() => expect(result.current.error).not.toBeNull());
      expect(result.current.error?.message).toBe("network down");
      expect(result.current.results).toEqual([]);
    });
  });
});
