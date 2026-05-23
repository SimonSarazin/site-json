// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { useHydrated } from "../useHydrated";

describe("useHydrated", () => {
  it("retourne true après le mount (jsdom)", () => {
    const { result } = renderHook(() => useHydrated());
    // useEffect s'exécute synchroniquement avec renderHook → true au premier render observable
    expect(result.current).toBe(true);
  });

  it("conserve la valeur true entre re-renders", () => {
    const { result, rerender } = renderHook(() => useHydrated());
    expect(result.current).toBe(true);
    rerender();
    expect(result.current).toBe(true);
  });
});
