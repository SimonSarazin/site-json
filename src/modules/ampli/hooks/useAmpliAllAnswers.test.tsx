// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

// `useFetchAnswerQuery` est mocké : ce qu'on teste ici est la MACHINE À
// ENCHAÎNER LES PAGES (le seul endroit où une boucle infinie ou un blocage à la
// page 2 peuvent se produire), pas la couche réseau.
const fetchNextPage = vi.fn();
let queryState: Record<string, unknown> = {};

vi.mock("./useFetchAnswerQuery", () => ({
  useFetchAnswerQuery: (params: Record<string, unknown>) => {
    lastParams = params;
    return { fetchNextPage, ...queryState };
  },
}));

let lastParams: Record<string, unknown> = {};

const { useAmpliAllAnswers, AMPLI_ALL_ANSWERS_DEFAULT_MAX } = await import("./useAmpliAllAnswers");

function state(overrides: Record<string, unknown> = {}) {
  return {
    transformedResults: [],
    totalCount: 0,
    isLoading: false,
    isPending: false,
    error: null,
    hasNextPage: false,
    isFetchNextPageError: false,
    isFetchingNextPage: false,
    ...overrides,
  };
}

const render = (props: Record<string, unknown> = {}) =>
  renderHook(() => useAmpliAllAnswers({ coformId: "form-1", ...props }));

describe("useAmpliAllAnswers — enchaînement des pages", () => {
  beforeEach(() => {
    fetchNextPage.mockClear();
    queryState = state();
  });

  it("demande la page suivante tant qu'il en reste", async () => {
    queryState = state({ hasNextPage: true, transformedResults: [{}, {}] });
    render();
    await waitFor(() => expect(fetchNextPage).toHaveBeenCalledTimes(1));
  });

  it("s'arrête dès qu'il n'y a plus de page (pas de boucle infinie)", async () => {
    queryState = state({ hasNextPage: false, transformedResults: [{}, {}] });
    const { rerender } = render();
    rerender();
    rerender();
    expect(fetchNextPage).not.toHaveBeenCalled();
  });

  it("n'enchaîne pas pendant qu'une page est en vol (une seule requête à la fois)", () => {
    queryState = state({ hasNextPage: true, isFetchingNextPage: true });
    render();
    expect(fetchNextPage).not.toHaveBeenCalled();
  });

  it("n'enchaîne pas pendant le chargement initial", () => {
    queryState = state({ hasNextPage: true, isLoading: true });
    render();
    expect(fetchNextPage).not.toHaveBeenCalled();
  });

  it("ne déclenche AUCUN appel quand la vue carte n'est pas affichée (enabled=false)", () => {
    queryState = state({ hasNextPage: true });
    render({ enabled: false });
    expect(fetchNextPage).not.toHaveBeenCalled();
    expect(lastParams.enabled).toBe(false);
  });

  it("s'arrête au plafond maxResults même s'il reste des pages", () => {
    queryState = state({ hasNextPage: true, transformedResults: Array.from({ length: 10 }, () => ({})) });
    const { result } = render({ maxResults: 10 });
    expect(fetchNextPage).not.toHaveBeenCalled();
    expect(result.current.capped).toBe(true);
    expect(result.current.isComplete).toBe(true);
  });

  it("plafond par défaut à 5000", () => {
    expect(AMPLI_ALL_ANSWERS_DEFAULT_MAX).toBe(5000);
  });

  // Régression : sur échec définitif d'une page, react-query conserve les pages
  // déjà chargées et repasse isFetchingNextPage à false SANS que `loaded` bouge.
  // Sans garde sur l'erreur, l'effet se rejouait et relançait fetchNextPage à
  // l'infini (une cascade de requêtes toutes les ~7 s, sans rien afficher).
  it("s'ARRÊTE après l'échec définitif d'une page (pas de relance en boucle)", () => {
    queryState = state({
      hasNextPage: true,
      isFetchNextPageError: true,
      transformedResults: [{}, {}],
      error: new Error("500"),
    });
    const { rerender } = render();
    rerender();
    rerender();
    expect(fetchNextPage).not.toHaveBeenCalled();
  });

  it("après un échec, la chaîne est déclarée terminée et le périmètre partiel", () => {
    queryState = state({ hasNextPage: true, isFetchNextPageError: true, transformedResults: [{}] });
    const { result } = render();
    // Sinon l'UI resterait sur son squelette de chargement pour toujours.
    expect(result.current.isComplete).toBe(true);
    expect(result.current.isPartial).toBe(true);
  });

  it("périmètre non partiel quand tout s'est bien passé", () => {
    queryState = state({ hasNextPage: false, transformedResults: [{}] });
    const { result } = render();
    expect(result.current.isPartial).toBe(false);
    expect(result.current.isComplete).toBe(true);
  });

  it("pose un cache LONG (une re-cascade complète ne doit pas repartir au moindre retour)", () => {
    render();
    expect(lastParams.cache).toEqual({ staleTime: 30 * 60 * 1000, gcTime: 60 * 60 * 1000 });
  });
});

describe("useAmpliAllAnswers — état exposé", () => {
  beforeEach(() => {
    fetchNextPage.mockClear();
    queryState = state();
  });

  it("expose la progression : chargés, total, complétude", () => {
    queryState = state({ transformedResults: [{}, {}, {}], totalCount: 12, hasNextPage: true });
    const { result } = render();
    expect(result.current.loaded).toBe(3);
    expect(result.current.total).toBe(12);
    expect(result.current.isComplete).toBe(false);
  });

  it("total à null quand le backend n'annonce pas de compte", () => {
    queryState = state({ totalCount: undefined });
    expect(render().result.current.total).toBeNull();
  });

  it("interroge le MÊME périmètre que la vue carte (clé de cache partagée map/split)", () => {
    render();
    expect(lastParams.view).toBe("map");
  });

  it("garde une référence stable pour une liste vide (pas d'invalidation des useMemo aval)", () => {
    const { result, rerender } = render();
    const first = result.current.results;
    rerender();
    expect(result.current.results).toBe(first);
  });
});
