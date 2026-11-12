// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import type { UsageConf } from "@/modules/observatoire/usage";
import type { Reservation } from "../lib/reservations";

/**
 * `useUsageMeasure` tient une seule fois, pour l'observatoire, la fiche et le bandeau, la règle « jamais de
 * classement sans les types des fiches » (review de la MR 120). La lecture des types elle-même a son test
 * (`useUsagerTypesQuery.test.ts`) : on la simule ici, et on regarde ce qui lui est demandé.
 */
const lecture = vi.hoisted(() => ({
  demandes: [] as Array<{ ids: readonly string[]; enabled: boolean }>,
  // Objet STABLE, comme le vrai hook (données en cache, sinon table vide constante).
  etat: { types: new Map<string, string>(), isLoading: false, failed: false, refetch: vi.fn() },
}));
vi.mock("./useUsagerTypesQuery", () => ({
  useUsagerTypesQuery: (ids: readonly string[], enabled: boolean) => {
    lecture.demandes.push({ ids, enabled });
    return lecture.etat;
  },
}));

import { useUsageMeasure } from "./useUsageMeasure";

const CONF: UsageConf = {
  referenceAmplitude: { startHour: 8, endHour: 22, days: 7 },
  schoolUserTypes: ["Etablissement scolaire"],
  schoolOrgTypes: ["GovernmentOrganization"],
};
const ORGA = "6a0b3078f16441794857e2a1";
const resa = (userId: string): Reservation => ({
  id: `r-${userId}`,
  resources: [{ id: "6a0b3078f16441794857e2f0" }],
  resourceIds: ["6a0b3078f16441794857e2f0"],
  user: "Club",
  userId,
  slots: [{ day: "monday", start: "17:00", end: "19:00", startMinutes: 1020, endMinutes: 1140 }],
});
const derniere = () => lecture.demandes[lecture.demandes.length - 1];

beforeEach(() => {
  lecture.demandes = [];
  lecture.etat.types = new Map();
  lecture.etat.isLoading = false;
  lecture.etat.failed = false;
});

describe("useUsageMeasure", () => {
  it("sans mesure d'usage : aucune lecture des types, ni attente ni échec", () => {
    const { result } = renderHook(() => useUsageMeasure([resa(ORGA)], undefined));
    expect(derniere()).toEqual({ ids: [], enabled: false });
    expect(result.current.loading).toBe(false);
    expect(result.current.failed).toBe(false);
  });

  it("attend les réservations, puis les types — demandés pour les seuls identifiants de base", () => {
    const { result, rerender } = renderHook(({ r }) => useUsageMeasure(r, CONF), {
      initialProps: { r: undefined as Reservation[] | undefined },
    });
    expect(result.current.loading).toBe(true);

    lecture.etat.isLoading = true;
    rerender({ r: [resa(ORGA), resa("club-saisi-a-la-main")] });
    expect(derniere()).toEqual({ ids: [ORGA], enabled: true });
    expect(result.current.loading).toBe(true);

    lecture.etat.isLoading = false;
    lecture.etat.types = new Map([[ORGA, "NGO"]]);
    rerender({ r: [resa(ORGA), resa("club-saisi-a-la-main")] });
    expect(result.current.loading).toBe(false);
    expect(result.current.types.get(ORGA)).toBe("NGO");
  });

  it("types en échec : `failed`, plus d'attente, nouvel essai par `refetch`", () => {
    lecture.etat.failed = true;
    const { result } = renderHook(() => useUsageMeasure([resa(ORGA)], CONF));
    expect(result.current.failed).toBe(true);
    expect(result.current.loading).toBe(false);
    expect(result.current.refetch).toBe(lecture.etat.refetch);
  });
});
