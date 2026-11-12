// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { ReactNode } from "react";
import { act, renderHook } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { PageFiltersProvider, usePageFiltersOptional } from "../contexts/pageFilters";
import type { Reservation } from "../lib/reservations";
import { INCLUDE_TYPE } from "../lib/searchByFieldsToQuery";
import type { UsageFilterConf } from "../schema";

/**
 * `useUsageFilter` : le statut demandé se lit dans l'URL et n'est PUBLIÉ dans l'état de la page — les
 * équipements retenus — qu'à l'arrivée des réservations. La logique pure dessous a ses propres tests
 * (`usageFilter.test.ts`).
 */
const requete = vi.hoisted(() => ({ data: undefined as unknown[] | undefined, actif: false }));
vi.mock("./useSlotReservationsQuery", () => ({
  useSlotReservationsQuery: (_conf: unknown, enabled: boolean) => {
    requete.actif = enabled;
    return { data: enabled ? requete.data : undefined, isError: false, refetch: () => {} };
  },
}));
// Table STABLE, comme celle du vrai hook (données en cache, sinon constante vide) : une table neuve à chaque
// rendu relancerait l'effet de publication en boucle.
const types = vi.hoisted(() => ({ types: new Map<string, string>(), isLoading: false, failed: false, refetch: vi.fn() }));
vi.mock("./useUsagerTypesQuery", () => ({
  useUsagerTypesQuery: () => types,
}));

import { useUsageFilter } from "./useUsageFilter";

const CONF: UsageFilterConf = {
  id: "statut",
  label: { fr: "Statut d'ouverture" },
  reservations: {
    form: "f",
    step: "e",
    fields: { finder: "F", user: "U", activity: "A", slots: "S", userType: "T" },
    usage: {
      referenceAmplitude: { startHour: 8, endHour: 22, days: 7 },
      schoolUserTypes: ["Etablissement scolaire"],
      schoolOrgTypes: ["GovernmentOrganization"],
    },
  },
};
const GYMNASE = "6a0b3078f16441794857e2f0";
const CLUB: Reservation = {
  id: "r1",
  resources: [{ id: GYMNASE }],
  resourceIds: [GYMNASE],
  user: "CLUB",
  userType: "Association sportive",
  slots: [{ day: "monday", start: "17:00", end: "19:00", startMinutes: 1020, endMinutes: 1140 }],
  periodStart: "2026-09-01",
  periodEnd: "2027-06-30",
};

const rendre = (url: string) =>
  renderHook(() => ({ filtre: useUsageFilter(CONF), page: usePageFiltersOptional() }), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <MemoryRouter initialEntries={[url]}>
        <PageFiltersProvider>{children}</PageFiltersProvider>
      </MemoryRouter>
    ),
  });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 28, 10, 0));
  requete.data = undefined;
  requete.actif = false;
  types.failed = false;
  types.refetch.mockClear();
});
afterEach(() => vi.useRealTimers());

describe("useUsageFilter", () => {
  it("sans statut dans l'URL : réservations non chargées, rien de publié", () => {
    const { result } = rendre("/equipements");
    expect(requete.actif).toBe(false);
    expect(result.current.filtre.status).toBeNull();
    expect(result.current.page?.searchByFields ?? {}).toEqual({});
  });

  it("statut demandé : en attente des réservations, puis publié en restriction sur _id", () => {
    const { result, rerender } = rendre("/equipements?statut=open");
    expect(result.current.filtre.pending).toBe(true);
    expect(result.current.filtre.applied).toBeNull();

    requete.data = [CLUB];
    rerender();
    expect(result.current.page?.searchByFields).toEqual({
      "statut:open": { field: "_id", type: INCLUDE_TYPE, value: [GYMNASE] },
    });
    expect(result.current.filtre.applied).toBe("open");
    expect(result.current.filtre.pending).toBe(false);
  });

  it("types des fiches en échec : rien de publié, erreur et nouvel essai des types", () => {
    types.failed = true;
    requete.data = [CLUB];
    const { result } = rendre("/equipements?statut=open");
    expect(result.current.page?.searchByFields ?? {}).toEqual({});
    expect(result.current.filtre.error).toBe(true);
    expect(result.current.filtre.pending).toBe(false);
    act(() => result.current.filtre.retry());
    expect(types.refetch).toHaveBeenCalledOnce();
  });

  it("apply(null) retire le statut de l'URL, puis l'entrée de l'état", () => {
    requete.data = [CLUB];
    const { result } = rendre("/equipements?statut=open");
    act(() => result.current.filtre.apply(null));
    expect(result.current.filtre.status).toBeNull();
    expect(result.current.page?.searchByFields).toEqual({});
  });
});
