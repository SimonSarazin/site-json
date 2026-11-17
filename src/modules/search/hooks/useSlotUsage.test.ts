// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import type { Reservation } from "../lib/reservations";
import type { ReservationsConf } from "../schema";

/**
 * `useSlotUsage` : les réservations de la fiche, lues seulement quand une carte ou la liste en a besoin, puis la
 * mesure partagée (`slotUsageOf`, testée à part). La requête est simulée : on regarde ce qui lui est demandé.
 */
const lecture = vi.hoisted(() => ({
  demandes: [] as Array<{ conf: unknown; enabled: boolean }>,
  etat: { data: undefined as Reservation[] | undefined, isLoading: false, isError: false, refetch: vi.fn() },
}));
vi.mock("./useSlotReservationsQuery", () => ({
  useSlotReservationsQuery: (conf: unknown, enabled: boolean) => {
    lecture.demandes.push({ conf, enabled });
    return lecture.etat;
  },
}));

import { useSlotUsage } from "./useSlotUsage";

const CONF = { form: "f", step: "s", fields: { finder: "fi", slots: "sl" } } as ReservationsConf;
const reservations: Reservation[] = [
  {
    id: "r1",
    resources: [{ id: "poi1" }],
    resourceIds: ["poi1"],
    user: "Club",
    periodStart: "2026-01-01",
    periodEnd: "2099-12-31",
    slots: [{ day: "monday", start: "17:00", end: "19:00", startMinutes: 1020, endMinutes: 1140 }],
  },
];
const derniere = () => lecture.demandes[lecture.demandes.length - 1];

beforeEach(() => {
  lecture.demandes = [];
  lecture.etat.data = undefined;
  lecture.etat.isLoading = false;
  lecture.etat.isError = false;
});

describe("useSlotUsage", () => {
  it("sans conf ou désactivé : aucune requête, rien en attente", () => {
    const { result } = renderHook(() => useSlotUsage(undefined));
    expect(derniere().enabled).toBe(false);
    expect(result.current.loading).toBe(false);
    renderHook(() => useSlotUsage(CONF, false));
    expect(derniere()).toEqual({ conf: CONF, enabled: false });
  });

  it("en attente des réservations, puis les équipements qui ont un planning", () => {
    lecture.etat.isLoading = true;
    const { result, rerender } = renderHook(() => useSlotUsage(CONF));
    expect(derniere()).toEqual({ conf: CONF, enabled: true });
    expect(result.current.loading).toBe(true);
    expect(result.current.usage).toBeUndefined();

    lecture.etat.isLoading = false;
    lecture.etat.data = reservations;
    rerender();
    expect(result.current.loading).toBe(false);
    expect([...(result.current.usage?.planned ?? [])]).toEqual(["poi1"]);
  });

  it("requête pas encore partie (rendu serveur) : en attente, pas « sans créneau »", () => {
    const { result } = renderHook(() => useSlotUsage(CONF));
    expect(result.current.loading).toBe(true);
    expect(result.current.usage).toBeUndefined();
  });

  it("échec sans réservations lues : `failed` ; avec des réservations déjà là, non", () => {
    lecture.etat.isError = true;
    const { result, rerender } = renderHook(() => useSlotUsage(CONF));
    expect(result.current.failed).toBe(true);
    lecture.etat.data = reservations;
    rerender();
    expect(result.current.failed).toBe(false);
  });
});
