// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { ReactNode } from "react";
import { act, renderHook } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { PageFiltersProvider, usePageFiltersOptional } from "../contexts/pageFilters";
import { slotToParam } from "../lib/slotFilter";
import type { Reservation } from "../lib/reservations";
import type { SlotFilterConf } from "../schema";

/**
 * `useSlotFilter` : le créneau demandé se lit dans l'URL et n'est PUBLIÉ dans l'état de la page — les ressources
 * occupées — qu'à l'arrivée des réservations ; un créneau incohérent est ignoré. La logique pure dessous a ses
 * propres tests (`slotFilter.test.ts`).
 */
const requete = vi.hoisted(() => ({ data: undefined as unknown[] | undefined, actif: false }));
vi.mock("./useSlotReservationsQuery", () => ({
  useSlotReservationsQuery: (_conf: unknown, enabled: boolean) => {
    requete.actif = enabled;
    return { data: enabled ? requete.data : undefined, isError: false, refetch: () => {} };
  },
}));

import { useSlotFilter } from "./useSlotFilter";

const CONF: SlotFilterConf = {
  id: "creneau",
  label: { fr: "Créneau disponible" },
  reservations: { form: "f", step: "e", fields: { finder: "F", user: "U", activity: "A", slots: "S" } },
};

/** Le gymnase est pris le lundi 17 h – 19 h toute la saison (un identifiant de base : seuls ceux-là filtrent). */
const GYMNASE = "6a0b3078f16441794857e2f0";
const PRIS: Reservation = {
  id: "r1",
  resources: [{ id: GYMNASE }],
  resourceIds: [GYMNASE],
  user: "CLUB",
  slots: [{ day: "monday", start: "17:00", end: "19:00", startMinutes: 1020, endMinutes: 1140 }],
  periodStart: "2026-09-01",
  periodEnd: "2027-06-30",
};
const LUNDI_SOIR = { days: ["monday" as const], start: "18:00", end: "20:00", periodStart: "2026-11-02", periodEnd: "2026-12-18" };

const rendre = (url: string) =>
  renderHook(() => ({ filtre: useSlotFilter(CONF), page: usePageFiltersOptional() }), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <MemoryRouter initialEntries={[url]}>
        <PageFiltersProvider>{children}</PageFiltersProvider>
      </MemoryRouter>
    ),
  });
const occupees = (page: ReturnType<typeof usePageFiltersOptional>) =>
  Object.values(page?.searchByFields ?? {}).flatMap((e) => (Array.isArray(e.value) ? e.value : []));

beforeEach(() => {
  // Horloge figée : « aujourd'hui » borne les périodes non saisies.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 27, 10, 0));
  requete.data = undefined;
  requete.actif = false;
});
afterEach(() => {
  vi.useRealTimers();
});

describe("useSlotFilter", () => {
  it("créneau de l'URL : en attente des réservations, puis appliqué avec les ressources occupées", () => {
    const { result, rerender } = rendre(`/?creneau=${slotToParam(LUNDI_SOIR)}`);
    expect(requete.actif).toBe(true);
    expect(result.current.filtre.pending).toBe(true);
    expect(result.current.filtre.applied).toBeNull();
    expect(occupees(result.current.page)).toEqual([]);

    requete.data = [PRIS];
    rerender();
    expect(result.current.filtre.pending).toBe(false);
    expect(result.current.filtre.applied).toEqual(result.current.filtre.slot);
    expect(occupees(result.current.page)).toEqual([GYMNASE]);
  });

  it("créneau incohérent dans l'URL (fin avant début) : ignoré, rien n'est chargé", () => {
    const { result } = rendre(`/?creneau=${slotToParam({ days: ["monday"], start: "20:00", end: "18:00" })}`);
    expect(result.current.filtre.slot).toBeNull();
    expect(requete.actif).toBe(false);
  });

  it("`apply` écrit le créneau dans l'URL, `null` le retire avec ses ressources occupées", () => {
    requete.data = [PRIS];
    const { result } = rendre("/");
    act(() => result.current.filtre.apply(LUNDI_SOIR));
    expect(result.current.filtre.slot).toEqual(LUNDI_SOIR);
    expect(occupees(result.current.page)).toEqual([GYMNASE]);

    act(() => result.current.filtre.apply(null));
    expect(result.current.filtre.slot).toBeNull();
    expect(occupees(result.current.page)).toEqual([]);
  });
});
