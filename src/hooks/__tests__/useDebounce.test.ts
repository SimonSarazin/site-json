// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDebounce } from "../useDebounce";

describe("useDebounce", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("retourne la valeur initiale immédiatement", () => {
    const { result } = renderHook(() => useDebounce("hello", 500));
    expect(result.current).toBe("hello");
  });

  it("ne propage pas le changement avant la fin du délai", () => {
    const { result, rerender } = renderHook(({ v }) => useDebounce(v, 500), {
      initialProps: { v: "a" },
    });
    rerender({ v: "b" });
    expect(result.current).toBe("a");
    act(() => {
      vi.advanceTimersByTime(499);
    });
    expect(result.current).toBe("a");
  });

  it("propage le changement après le délai", () => {
    const { result, rerender } = renderHook(({ v }) => useDebounce(v, 500), {
      initialProps: { v: "a" },
    });
    rerender({ v: "b" });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current).toBe("b");
  });

  it("reset le timer si la valeur change avant la fin", () => {
    const { result, rerender } = renderHook(({ v }) => useDebounce(v, 500), {
      initialProps: { v: "a" },
    });
    rerender({ v: "b" });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    rerender({ v: "c" });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    // 300+300=600ms mais le timer a redémarré à 300, donc à 600 il reste 200ms à attendre
    expect(result.current).toBe("a");
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current).toBe("c");
  });

  it("utilise 500ms par défaut", () => {
    const { result, rerender } = renderHook(({ v }) => useDebounce(v), {
      initialProps: { v: "a" },
    });
    rerender({ v: "b" });
    act(() => {
      vi.advanceTimersByTime(499);
    });
    expect(result.current).toBe("a");
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe("b");
  });

  it("accepte un délai personnalisé", () => {
    const { result, rerender } = renderHook(({ v }) => useDebounce(v, 100), {
      initialProps: { v: "a" },
    });
    rerender({ v: "b" });
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current).toBe("b");
  });

  it("fonctionne avec types non-string (objets, nombres)", () => {
    const initialObj = { count: 1 };
    const newObj = { count: 2 };
    const { result, rerender } = renderHook(({ v }) => useDebounce(v, 200), {
      initialProps: { v: initialObj },
    });
    expect(result.current).toBe(initialObj);
    rerender({ v: newObj });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current).toBe(newObj);
  });

  it("nettoie le timer au démontage", () => {
    const { rerender, unmount } = renderHook(({ v }) => useDebounce(v, 500), {
      initialProps: { v: "a" },
    });
    rerender({ v: "b" });
    unmount();
    // Avancer le temps après unmount ne doit pas crasher (pas de setState sur unmount)
    expect(() => {
      vi.advanceTimersByTime(1000);
    }).not.toThrow();
  });
});
