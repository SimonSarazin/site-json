// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import type { Reservation } from "../lib/reservations";
import type { BookedResourcesConf, ReservationsConf } from "../schema";

/**
 * `useOrgaBookedHours` : une lecture des réservations et un contrôle de périmètre pour toutes les cartes, puis le
 * total de la fiche (`orgaBookedHours`, testé dans `reservationHours.test.ts`). Les deux requêtes sont simulées.
 */
const lecture = vi.hoisted(() => ({
  reservations: { data: undefined as Reservation[] | undefined, isLoading: false, isError: false },
  perimetre: { allowed: null as string[] | null, isLoading: false, isError: false },
  demandesPerimetre: [] as Array<{ ids: readonly string[]; booked: unknown }>,
  demandesReservations: [] as boolean[],
}));
vi.mock("./useSlotReservationsQuery", () => ({
  useSlotReservationsQuery: (_conf: unknown, enabled: boolean) => {
    lecture.demandesReservations.push(enabled);
    return lecture.reservations;
  },
}));
vi.mock("./useResourcesInPerimeterQuery", () => ({
  useResourcesInPerimeterQuery: (ids: readonly string[], booked: unknown) => {
    lecture.demandesPerimetre.push({ ids, booked });
    return lecture.perimetre;
  },
}));

import { useOrgaBookedHours } from "./useOrgaBookedHours";

const CLUB = "6a0b3078f16441794857e2a1";
const POI_A = "6a0b3078f16441794857e2f0";
const POI_B = "6a0b3078f16441794857e2f1";
const CONF = { form: "f", step: "s", fields: { finder: "fi", slots: "sl" } } as ReservationsConf;
const BOOKED: BookedResourcesConf = { poiFilters: { type: "recoveryCenter" }, hours: true };
// Un créneau du lundi 2 h, sur une période qui couvre aujourd'hui (quelle que soit la date du test).
const resa = (poi: string): Reservation => ({
  id: `r-${poi}`,
  resources: [{ id: poi }],
  resourceIds: [poi],
  user: "Club",
  userId: CLUB,
  periodStart: "2026-01-05",
  periodEnd: "2099-12-28",
  slots: [{ day: "monday", start: "17:00", end: "19:00", startMinutes: 1020, endMinutes: 1140 }],
});

beforeEach(() => {
  lecture.reservations = { data: undefined, isLoading: false, isError: false };
  lecture.perimetre = { allowed: null, isLoading: false, isError: false };
  lecture.demandesPerimetre = [];
  lecture.demandesReservations = [];
});

describe("useOrgaBookedHours", () => {
  it("sans conf (carte sans l'option) : aucune lecture, rien en attente", () => {
    const { result } = renderHook(() => useOrgaBookedHours(CLUB, undefined, BOOKED));
    expect(lecture.demandesReservations[lecture.demandesReservations.length - 1]).toBe(false);
    expect(lecture.demandesPerimetre[lecture.demandesPerimetre.length - 1]?.booked).toBeUndefined();
    expect(result.current).toEqual({ hours: undefined, loading: false, failed: false });
  });

  it("attend les réservations, puis contrôle le périmètre de TOUS les équipements réservés", () => {
    lecture.reservations.isLoading = true;
    const { result, rerender } = renderHook(() => useOrgaBookedHours(CLUB, CONF, BOOKED));
    expect(result.current.loading).toBe(true);
    expect(result.current.hours).toBeUndefined();

    lecture.reservations = { data: [resa(POI_A), resa(POI_B)], isLoading: false, isError: false };
    lecture.perimetre = { allowed: [POI_B], isLoading: false, isError: false };
    rerender();
    expect(lecture.demandesPerimetre[lecture.demandesPerimetre.length - 1]).toEqual({ ids: [POI_A, POI_B], booked: BOOKED });
    // Seul l'équipement du périmètre compte : 2 h par semaine.
    expect(result.current.hours?.weeklyMinutes).toBe(120);
    expect(result.current.loading).toBe(false);
  });

  it("requête pas encore partie (rendu serveur) : en attente, ni « — » ni 0", () => {
    const { result } = renderHook(() => useOrgaBookedHours(CLUB, CONF, BOOKED));
    expect(result.current).toEqual({ hours: undefined, loading: true, failed: false });
  });

  it("réservations ou périmètre en échec : `failed`", () => {
    lecture.reservations.isError = true;
    const { result, rerender } = renderHook(() => useOrgaBookedHours(CLUB, CONF, BOOKED));
    expect(result.current.failed).toBe(true);
    lecture.reservations = { data: [resa(POI_A)], isLoading: false, isError: false };
    lecture.perimetre = { allowed: [], isLoading: false, isError: true };
    rerender();
    expect(result.current.failed).toBe(true);
  });
});
