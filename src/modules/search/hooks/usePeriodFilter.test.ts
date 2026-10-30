// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { usePeriodFilter } from "./usePeriodFilter";

/**
 * `usePeriodFilter` : filtre « du … au … » des sections de réservations. Sans saisie, la section montre les
 * créneaux en cours ou à venir ; une saisie incohérente est signalée et la section garde ce défaut ; sans
 * l'option, aucune période. La règle pure dessous (`resolvePeriodFilter`) a ses propres tests.
 */
const AUJOURDHUI = "2026-10-27";

describe("usePeriodFilter", () => {
  it("sans saisie, à partir d'aujourd'hui ; une saisie cohérente s'applique", () => {
    const { result } = renderHook(() => usePeriodFilter(true, AUJOURDHUI));
    expect(result.current.range).toEqual({ periodStart: AUJOURDHUI });

    act(() => {
      result.current.filter.onFrom("2026-11-02");
      result.current.filter.onTo("2026-12-18");
    });
    expect(result.current.range).toEqual({ periodStart: "2026-11-02", periodEnd: "2026-12-18" });
    expect(result.current.filter.invalid).toBe(false);
  });

  it("une saisie incohérente est signalée, la section garde son défaut ; « réinitialiser » vide la saisie", () => {
    const { result } = renderHook(() => usePeriodFilter(true, AUJOURDHUI));
    act(() => {
      result.current.filter.onFrom("2026-12-01");
      result.current.filter.onTo("2026-11-30");
    });
    expect(result.current.filter.invalid).toBe(true);
    expect(result.current.range).toEqual({ periodStart: AUJOURDHUI });

    act(() => result.current.filter.onReset());
    expect(result.current.filter.from).toBe("");
    expect(result.current.filter.to).toBe("");
    expect(result.current.filter.invalid).toBe(false);
  });

  it("sans l'option, aucune période : la section garde toutes les réservations", () => {
    const { result } = renderHook(() => usePeriodFilter(false, AUJOURDHUI));
    expect(result.current.range).toBeNull();
  });
});
