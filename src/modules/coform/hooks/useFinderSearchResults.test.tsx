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

/** L'entité hôte courante — `null` simule un hôte pas (ou plus) disponible. */
let entiteHote: typeof entityMock | null = entityMock;
vi.mock("@/hooks/useCocolight", () => ({
  useCocolight: () => ({ entity: entiteHote, helper: helperMock }),
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
    entiteHote = entityMock;
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

  describe("réponse conservée entre deux frappes", () => {
    // La liste se vidait à chaque frappe (nouvelle clé de requête, données `undefined` le temps de la
    // réponse) : la modale changeait de taille et sautait de 84 px (mesuré le 01/10).
    it("la réponse précédente reste affichée pendant la recherche suivante", async () => {
      searchCostumMock.mockResolvedValueOnce({ results: [makeSdkInstance("a1", "Suite126")] });
      let repondre: (v: unknown) => void = () => {};
      searchCostumMock.mockImplementationOnce(() => new Promise((r) => { repondre = r; }));

      const { result, rerender } = renderHook(
        ({ q }: { q: string }) => useFinderSearchResults({ query: q, config: makeConfig(), enabled: true }),
        { wrapper: makeWrapper(), initialProps: { q: "suite" } }
      );
      await waitFor(() => expect(result.current.results.map((r) => r.name)).toEqual(["Suite126"]));
      expect(result.current.isCurrentAnswer).toBe(true);

      rerender({ q: "suite12" });
      await waitFor(() => expect(searchCostumMock).toHaveBeenCalledTimes(2));
      // Recherche en vol : l'ancienne réponse tient la place — mais ce n'est pas celle de la saisie.
      expect(result.current.isFetching).toBe(true);
      expect(result.current.results.map((r) => r.name)).toEqual(["Suite126"]);
      expect(result.current.isCurrentAnswer).toBe(false);

      repondre({ results: [makeSdkInstance("b2", "Suite126 bis")] });
      await waitFor(() => expect(result.current.results.map((r) => r.name)).toEqual(["Suite126 bis"]));
      expect(result.current.isCurrentAnswer).toBe(true);
    });

    it("pendant le debounce, la réponse affichée est celle de la frappe d'avant : elle ne conclut rien", async () => {
      searchCostumMock.mockResolvedValue({ results: [] });
      const { result, rerender } = renderHook(
        ({ q }: { q: string }) => useFinderSearchResults({ query: q, config: makeConfig(), enabled: true }),
        { wrapper: makeWrapper(), initialProps: { q: "suite" } }
      );
      await waitFor(() => expect(result.current.isCurrentAnswer).toBe(true));

      // « Aucun résultat pour "suite12" » s'affichait avant même l'appel pour « suite12 ».
      rerender({ q: "suite12" });
      expect(result.current.isCurrentAnswer).toBe(false);
      await waitFor(() => expect(result.current.isCurrentAnswer).toBe(true));
    });

    it("une réponse VIDE conservée ne conclut pas pour la saisie suivante (champ vidé puis retapé)", async () => {
      // Mesuré à la revue : « xyz » sans résultat, champ vidé, puis « ma » — pendant la requête de « ma »,
      // la modale affichait « Aucun résultat pour "ma" » et un « Ajouter » cliquable.
      searchCostumMock.mockResolvedValueOnce({ results: [] });
      let repondre: (v: unknown) => void = () => {};
      searchCostumMock.mockImplementationOnce(() => new Promise((r) => { repondre = r; }));
      const { result, rerender } = renderHook(
        ({ q }: { q: string }) => useFinderSearchResults({ query: q, config: makeConfig(), enabled: true }),
        { wrapper: makeWrapper(), initialProps: { q: "xyz" } }
      );
      await waitFor(() => expect(result.current.isCurrentAnswer).toBe(true));
      expect(result.current.results).toEqual([]);

      rerender({ q: "" });
      await new Promise((r) => setTimeout(r, DEBOUNCE_DELAY_MS));
      rerender({ q: "ma" });
      await waitFor(() => expect(searchCostumMock).toHaveBeenCalledTimes(2));
      expect(result.current.isFetching).toBe(true);
      expect(result.current.results).toEqual([]);
      expect(result.current.isCurrentAnswer).toBe(false);

      repondre({ results: [makeSdkInstance("m1", "Maison")] });
      await waitFor(() => expect(result.current.isCurrentAnswer).toBe(true));
      expect(result.current.results.map((r) => r.name)).toEqual(["Maison"]);
    });

    it("sous le seuil, aucun résultat — pas même la réponse conservée", async () => {
      searchCostumMock.mockResolvedValueOnce({ results: [makeSdkInstance("a1", "Suite126")] });
      const { result, rerender } = renderHook(
        ({ q }: { q: string }) => useFinderSearchResults({ query: q, config: makeConfig(), enabled: true }),
        { wrapper: makeWrapper(), initialProps: { q: "suite" } }
      );
      await waitFor(() => expect(result.current.results).toHaveLength(1));

      rerender({ q: "s" });
      await waitFor(() => expect(result.current.results).toEqual([]));
      expect(result.current.isCurrentAnswer).toBe(false);
    });
  });

  describe("erreurs", () => {
    it("une erreur de la saisie courante est exposée, et `retry` relance la recherche", async () => {
      searchCostumMock.mockRejectedValueOnce(new Error("502 Bad Gateway"));
      searchCostumMock.mockResolvedValueOnce({ results: [makeSdkInstance("a1", "Suite126")] });
      const { result } = renderHook(
        () => useFinderSearchResults({ query: "suite", config: makeConfig(), enabled: true }),
        { wrapper: makeWrapper() }
      );
      await waitFor(() => expect(result.current.error?.message).toBe("502 Bad Gateway"));
      expect(result.current.isCurrentAnswer).toBe(false);
      expect(result.current.isFetching).toBe(false);

      result.current.retry();
      await waitFor(() => expect(result.current.isCurrentAnswer).toBe(true));
      expect(result.current.error).toBeNull();
      expect(result.current.results.map((r) => r.name)).toEqual(["Suite126"]);
    });

    it("une saisie en échec ne garde pas la liste de la saisie d'avant : rien ne s'affiche sous l'alerte", async () => {
      // La réponse précédente ne tient la place que PENDANT une recherche — pas après son échec.
      searchCostumMock.mockResolvedValueOnce({ results: [makeSdkInstance("a1", "Suite126")] });
      searchCostumMock.mockRejectedValueOnce(new Error("502 Bad Gateway"));
      const { result, rerender } = renderHook(
        ({ q }: { q: string }) => useFinderSearchResults({ query: q, config: makeConfig(), enabled: true }),
        { wrapper: makeWrapper(), initialProps: { q: "ab" } }
      );
      await waitFor(() => expect(result.current.results.map((r) => r.name)).toEqual(["Suite126"]));

      rerender({ q: "abc" });
      await waitFor(() => expect(result.current.error?.message).toBe("502 Bad Gateway"));
      expect(result.current.results).toEqual([]);
      expect(result.current.isCurrentAnswer).toBe(false);
    });

    it("l'erreur d'une saisie s'efface dès la frappe suivante, sans attendre le debounce", async () => {
      searchCostumMock.mockRejectedValueOnce(new Error("502 Bad Gateway"));
      searchCostumMock.mockResolvedValue({ results: [] });
      const { result, rerender } = renderHook(
        ({ q }: { q: string }) => useFinderSearchResults({ query: q, config: makeConfig(), enabled: true }),
        { wrapper: makeWrapper(), initialProps: { q: "abc" } }
      );
      await waitFor(() => expect(result.current.error).not.toBeNull());

      // L'alerte de « abc » ne doit pas rester affichée sous « abcd ».
      rerender({ q: "abcd" });
      expect(result.current.error).toBeNull();
    });

    it("sans entité hôte, une erreur plutôt qu'une attente sans fin — et pas de relance possible", async () => {
      entiteHote = null;
      const { result } = renderHook(
        () => useFinderSearchResults({ query: "suite", config: makeConfig(), enabled: true }),
        { wrapper: makeWrapper() }
      );
      await waitFor(() => expect(result.current.error).not.toBeNull());
      expect(result.current.isCurrentAnswer).toBe(false);
      expect(result.current.canRetry).toBe(false);
      expect(searchCostumMock).not.toHaveBeenCalled();
    });

    it("sous le seuil, aucune erreur à dire", async () => {
      entiteHote = null;
      const { result } = renderHook(
        () => useFinderSearchResults({ query: "s", config: makeConfig(), enabled: true }),
        { wrapper: makeWrapper() }
      );
      await new Promise((r) => setTimeout(r, DEBOUNCE_DELAY_MS));
      expect(result.current.error).toBeNull();
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

    it("inclusions mono-valeur → scalaire { attributeName: valueName } (parité historique)", async () => {
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

    it("config.sourceKey → périmètre explicite émis, notSourceKey retiré même à true", async () => {
      searchCostumMock.mockResolvedValue({ results: [] });
      renderHook(
        () =>
          useFinderSearchResults({
            query: "test5",
            config: makeConfig({ notSourceKey: true, sourceKey: ["federationDesCae"] }),
            enabled: true,
          }),
        { wrapper: makeWrapper() }
      );
      await waitFor(() => expect(searchCostumMock).toHaveBeenCalledTimes(1));
      expect(searchCostumMock.mock.calls[0][0].sourceKey).toEqual(["federationDesCae"]);
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
