// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePagedFeedNav } from "./useArticleFeed";

/**
 * Ce que ces tests protègent : la navigation « pages » d'`articleFeed` (`pagination:"pages"`) repose
 * sur un curseur backend (pas de saut direct à une page N jamais chargée, cf. en-tête du hook) — un
 * bug ici afficherait soit une page qui n'existe plus après un changement de filtre, soit un double
 * fetch en sautant une page. Le reset sur `resetSignal` est vérifié EN ÉCHEC (cf. CLAUDE.md, discipline
 * e2e/guard) : sans le `if (resetSignal !== prevSignal)`, le 2ᵉ test ci-dessous serait rouge (pageIndex
 * resterait à 1 après le changement de filtre).
 */
describe("usePagedFeedNav", () => {
  it("goToPage sur une page déjà chargée : instantané, aucun fetch", () => {
    const fetchNextPage = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      usePagedFeedNav({ fetchedPages: 3, hasNextPage: true, isFetchingNextPage: false, fetchNextPage, resetSignal: "a" }),
    );
    act(() => result.current.goToPage(1));
    expect(result.current.pageIndex).toBe(1);
    expect(fetchNextPage).not.toHaveBeenCalled();
  });

  it("goToPage sur la page suivante jamais chargée : UN SEUL fetchNextPage, page affichée une fois chargée", async () => {
    // `fetchedPages` grandit APRÈS résolution du fetch (comme `data.pages.length` en vrai, une fois
    // React Query re-rendu) : sans ce rerender, le clamp de sûreté ramènerait `pageIndex` en arrière —
    // ce test échoue si on le retire (vérifié en échec avant ce correctif de test).
    let fetchedPages = 2;
    const fetchNextPage = vi.fn().mockImplementation(async () => { fetchedPages = 3; });
    const { result, rerender } = renderHook(
      (props: { fetchedPages: number }) =>
        usePagedFeedNav({ ...props, hasNextPage: true, isFetchingNextPage: false, fetchNextPage, resetSignal: "a" }),
      { initialProps: { fetchedPages } },
    );
    await act(async () => {
      result.current.goToPage(2);
      await new Promise((r) => setTimeout(r, 0));
    });
    rerender({ fetchedPages });
    expect(fetchNextPage).toHaveBeenCalledTimes(1);
    expect(result.current.pageIndex).toBe(2);
  });

  it("goToPage au-delà de la page suivante immédiate : aucun fetch, aucun changement (jamais de saut)", () => {
    const fetchNextPage = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      usePagedFeedNav({ fetchedPages: 2, hasNextPage: true, isFetchingNextPage: false, fetchNextPage, resetSignal: "a" }),
    );
    act(() => result.current.goToPage(5));
    expect(fetchNextPage).not.toHaveBeenCalled();
    expect(result.current.pageIndex).toBe(0);
  });

  it("un changement de `resetSignal` (nouveau filtre) remet pageIndex à 0", () => {
    const fetchNextPage = vi.fn().mockResolvedValue(undefined);
    const { result, rerender } = renderHook(
      ({ resetSignal }) =>
        usePagedFeedNav({ fetchedPages: 3, hasNextPage: false, isFetchingNextPage: false, fetchNextPage, resetSignal }),
      { initialProps: { resetSignal: "villes:none" } },
    );
    act(() => result.current.goToPage(2));
    expect(result.current.pageIndex).toBe(2);

    rerender({ resetSignal: "villes:arras" });
    expect(result.current.pageIndex).toBe(0);
  });

  it("pageCount inclut la page suivante non chargée uniquement si `hasNextPage`", () => {
    const fetchNextPage = vi.fn();
    const { result, rerender } = renderHook(
      ({ hasNextPage }) =>
        usePagedFeedNav({ fetchedPages: 2, hasNextPage, isFetchingNextPage: false, fetchNextPage, resetSignal: "a" }),
      { initialProps: { hasNextPage: true } },
    );
    expect(result.current.pageCount).toBe(3);
    rerender({ hasNextPage: false });
    expect(result.current.pageCount).toBe(2);
  });
});
