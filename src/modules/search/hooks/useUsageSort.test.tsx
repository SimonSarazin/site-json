// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { act, renderHook } from "@testing-library/react";
import { MemoryRouter, useSearchParams } from "react-router";
import type { ReservationsConf } from "../schema";

/**
 * `useUsageSort` : l'ordre vit dans l'URL, les taux viennent de `useSlotUsage` (simulé ici, testé à part), lu
 * seulement quand un tri est demandé.
 */
const lecture = vi.hoisted(() => ({
  demandes: [] as boolean[],
  etat: {
    usage: undefined as { planned: Set<string>; rates: Map<string, number> } | undefined,
    loading: false,
    failed: false,
    refetch: vi.fn(),
  },
}));
vi.mock("./useSlotUsage", () => ({
  useSlotUsage: (_conf: unknown, enabled: boolean) => {
    lecture.demandes.push(enabled);
    return lecture.etat;
  },
}));

import { useUsageSort } from "./useUsageSort";

const RESERVATIONS = {
  form: "f",
  step: "s",
  fields: { finder: "fi", slots: "sl" },
  usage: { referenceAmplitude: { startHour: 8, endHour: 22, days: 7 }, schoolUserTypes: [] },
} as unknown as ReservationsConf;

const wrapper = (url: string) => ({ children }: { children: ReactNode }) => (
  <MemoryRouter initialEntries={[url]}>{children}</MemoryRouter>
);

beforeEach(() => {
  lecture.demandes = [];
  lecture.etat.usage = undefined;
  lecture.etat.loading = false;
});

describe("useUsageSort", () => {
  it("sans tri demandé : ordre du serveur, aucune réservation lue", () => {
    const { result } = renderHook(() => useUsageSort({}, RESERVATIONS), { wrapper: wrapper("/equipements") });
    expect(result.current.enabled).toBe(true);
    expect(result.current.order).toBeNull();
    expect(lecture.demandes[lecture.demandes.length - 1]).toBe(false);
  });

  it("ordre lu dans l'URL (param configurable) ; taux renvoyés une fois lus", () => {
    lecture.etat.loading = true;
    const { result, rerender } = renderHook(() => useUsageSort({ id: "taux" }, RESERVATIONS), {
      wrapper: wrapper("/equipements?taux=desc"),
    });
    expect(result.current.order).toBe("desc");
    expect(result.current.loading).toBe(true);
    expect(lecture.demandes[lecture.demandes.length - 1]).toBe(true);

    lecture.etat.loading = false;
    lecture.etat.usage = { planned: new Set(["a"]), rates: new Map([["a", 0.3]]) };
    rerender();
    expect(result.current.rates?.get("a")).toBe(0.3);
  });

  it("setOrder écrit puis retire le param", () => {
    const { result } = renderHook(
      () => ({ sort: useUsageSort({}, RESERVATIONS), params: useSearchParams()[0] }),
      { wrapper: wrapper("/equipements?type=gymnase") },
    );
    act(() => result.current.sort.setOrder("asc"));
    expect(result.current.params.get("tri")).toBe("asc");
    expect(result.current.params.get("type")).toBe("gymnase");
    act(() => result.current.sort.setOrder(null));
    expect(result.current.params.has("tri")).toBe(false);
  });

  it("sans mesure d'usage (pas de plage de référence) : inactif, même avec un ordre dans l'URL", () => {
    const { result } = renderHook(() => useUsageSort({}, { ...RESERVATIONS, usage: undefined }), {
      wrapper: wrapper("/equipements?tri=desc"),
    });
    expect(result.current.enabled).toBe(false);
    expect(result.current.order).toBeNull();
  });
});
