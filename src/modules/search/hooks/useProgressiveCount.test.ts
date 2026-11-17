// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createElement, Fragment } from "react";
import { act, render, renderHook, screen } from "@testing-library/react";
import { useProgressiveCount } from "./useProgressiveCount";

/**
 * jsdom n'a pas d'IntersectionObserver : une version qui se comporte comme la vraie — un rappel à l'observation
 * (état initial), puis seulement aux CHANGEMENTS de visibilité (`basculer`). Une sentinelle qui reste à l'écran ne
 * rappelle donc pas : c'est ce qui figeait la liste.
 */
let visible = false;
const actifs = new Set<FauxObserver>();
class FauxObserver {
  constructor(private readonly callback: IntersectionObserverCallback) {}
  observe() {
    actifs.add(this);
    this.notifier();
  }
  disconnect() {
    actifs.delete(this);
  }
  notifier() {
    this.callback([{ isIntersecting: visible } as IntersectionObserverEntry], this as never);
  }
}
const basculer = (v: boolean) => {
  visible = v;
  for (const o of [...actifs]) o.notifier();
};

beforeEach(() => {
  vi.stubGlobal("IntersectionObserver", FauxObserver);
});
afterEach(() => {
  vi.unstubAllGlobals();
  visible = false;
  actifs.clear();
});

describe("useProgressiveCount", () => {
  it("une tranche d'abord, une de plus quand la sentinelle est visible, jamais au-delà du total", () => {
    const { result } = renderHook(() => useProgressiveCount(50, 24, "desc"));
    expect(result.current).toMatchObject({ count: 24, hasMore: true });
    act(() => result.current.sentinelRef(document.createElement("div")));

    act(() => basculer(true));
    expect(result.current.count).toBe(48);
    act(() => basculer(false));
    expect(result.current.count).toBe(48);
    act(() => basculer(true));
    expect(result.current).toMatchObject({ count: 50, hasMore: false });
  });

  it("sentinelle toujours à l'écran après une tranche (écran haut, cartes denses) : les tranches s'enchaînent", () => {
    visible = true;
    function Liste() {
      const { count, hasMore, sentinelRef } = useProgressiveCount(60, 24, "desc");
      return createElement(Fragment, null, createElement("output", null, count), hasMore && createElement("div", { ref: sentinelRef }));
    }
    render(createElement(Liste));
    // 24 → 48 au premier rappel, puis 48 → 60 sans que la sentinelle ait quitté l'écran.
    expect(screen.getByRole("status")).toHaveTextContent("60");
    expect(actifs.size).toBe(0);
  });

  it("autre clé (autre ordre, autres filtres) : retour à la première tranche", () => {
    const { result, rerender } = renderHook(({ key }) => useProgressiveCount(50, 24, key), {
      initialProps: { key: "desc" },
    });
    act(() => result.current.sentinelRef(document.createElement("div")));
    act(() => basculer(true));
    expect(result.current.count).toBe(48);
    rerender({ key: "asc" });
    expect(result.current.count).toBe(24);
  });

  it("liste plus courte qu'une tranche : tout, sans suite", () => {
    const { result } = renderHook(() => useProgressiveCount(5, 24, "desc"));
    expect(result.current).toMatchObject({ count: 5, hasMore: false });
  });
});
