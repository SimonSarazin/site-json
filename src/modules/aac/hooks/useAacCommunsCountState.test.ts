// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

/**
 * `reachable` sépare une ATTENTE (formulaire en résolution) d'une ABSENCE (pas d'AAC, résolution
 * en échec ou close sans résultat) — et le décompte ne part que si la surface le veut ET qu'il
 * peut aboutir.
 */

const state = vi.hoisted(() => ({
  context: { formId: "form-1" as string | null, resolved: {} as unknown, isFormLoading: false, configError: null as Error | null },
  count: { count: null as number | null, isLoading: false, error: null as Error | null },
}));

vi.mock("./useAacDirectoryContext", () => ({
  useAacDirectoryContext: () => state.context,
}));

const countSpy = vi.fn();
vi.mock("./useAacCommunsCount", () => ({
  useAacCommunsCount: (enabled: boolean) => {
    countSpy(enabled);
    return state.count;
  },
}));

import { useAacCommunsCountState } from "./useAacCommunsCountState";

beforeEach(() => {
  state.context = { formId: "form-1", resolved: {}, isFormLoading: false, configError: null };
  state.count = { count: null, isLoading: false, error: null };
  countSpy.mockClear();
});

describe("useAacCommunsCountState", () => {
  it("formulaire résolu : décompte lancé, chiffre rendu", () => {
    state.count = { count: 144, isLoading: false, error: null };
    const { result } = renderHook(() => useAacCommunsCountState(true));
    expect(countSpy).toHaveBeenCalledWith(true);
    expect(result.current).toEqual({ count: 144, error: null, reachable: true });
  });

  it("formulaire en résolution : joignable (une attente)", () => {
    state.context = { formId: "form-1", resolved: null, isFormLoading: true, configError: null };
    expect(renderHook(() => useAacCommunsCountState(true)).result.current.reachable).toBe(true);
  });

  it("pas d'AAC déclaré : injoignable, aucune requête", () => {
    state.context = { formId: null, resolved: null, isFormLoading: false, configError: null };
    const { result } = renderHook(() => useAacCommunsCountState(true));
    expect(result.current.reachable).toBe(false);
    expect(countSpy).toHaveBeenCalledWith(false);
  });

  it("résolution en échec : injoignable, aucune requête", () => {
    state.context = { formId: "form-1", resolved: null, isFormLoading: false, configError: new Error("403") };
    const { result } = renderHook(() => useAacCommunsCountState(true));
    expect(result.current.reachable).toBe(false);
    expect(countSpy).toHaveBeenCalledWith(false);
  });

  it("résolution close sans résultat (pas d'entité costum) : injoignable", () => {
    state.context = { formId: "form-1", resolved: null, isFormLoading: false, configError: null };
    expect(renderHook(() => useAacCommunsCountState(true)).result.current.reachable).toBe(false);
  });

  it("surface qui ne veut pas de chiffre : aucune requête", () => {
    renderHook(() => useAacCommunsCountState(false));
    expect(countSpy).toHaveBeenCalledWith(false);
  });
});
