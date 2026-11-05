// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { AllStepsData, TimeSlotValue } from "@/modules/coform/types";
import type { Reservation, ReservationSlot } from "../lib/reservations";
import type { ReservationsConf } from "../schema";

/**
 * `useBookingChecks` : contrôles d'un AJOUT de créneaux. Le refus d'enregistrer se juge sur les réservations
 * RELUES, l'avertissement en direct sur celles en cache, un message par créneau à son index brut. Les trois
 * rappels gardent leur identité d'un rendu à l'autre — `t`, recréé à chaque rendu par `useT`, n'en est pas une
 * dépendance (review de la MR 114) — et changent avec la langue.
 */
const ctx = vi.hoisted(() => ({ lang: "fr", entity: { id: "site" } as object | null }));
vi.mock("@/hooks/useCocolight", () => ({ useCocolight: () => ({ entity: ctx.entity }) }));
// Comme le vrai `useT` : une fonction NEUVE à chaque rendu, figée sur la langue de ce rendu.
vi.mock("@/hooks/useT", () => ({
  useT: () => {
    const lang = ctx.lang;
    return (key: string, _fallback?: string, params?: Record<string, unknown>) =>
      params ? `${lang}:${key} ${JSON.stringify(params)}` : `${lang}:${key}`;
  },
}));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ i18n: { language: ctx.lang } }) }));
vi.mock("@/dateFns", () => ({ default: () => undefined }));
const resourcesReservations = vi.fn();
vi.mock("./useReservationsQuery", () => ({
  resourcesReservations: (...args: unknown[]) => resourcesReservations(...args),
}));

import { useBookingChecks } from "./useBookingChecks";

const STEP = "etape";
const CONF: ReservationsConf = {
  form: "form-creneaux",
  step: STEP,
  fields: { finder: "equipement", user: "usager", activity: "activite", slots: "creneaux", periodStart: "debut", periodEnd: "fin" },
  periods: true,
};

const brut = (day: string, sh: string, eh: string): TimeSlotValue => ({
  day,
  startHour: sh,
  startMinute: "00",
  endHour: eh,
  endMinute: "00",
});
/** Une saisie du formulaire : le gymnase, la période, les créneaux bruts du champ. */
const saisie = (creneaux: TimeSlotValue[]): AllStepsData => ({
  [STEP]: {
    [`finder${STEP}equipement`]: { gymnase: { id: "gymnase", name: "Gymnase", type: "poi" } },
    [`${STEP}creneaux`]: creneaux,
    [`${STEP}debut`]: "2026-11-02",
    [`${STEP}fin`]: "2026-12-18",
  },
});

const lundi: ReservationSlot = { day: "monday", start: "17:00", end: "19:00", startMinutes: 1020, endMinutes: 1140, index: 0 };
/** Le lundi 17 h – 19 h du gymnase est déjà pris par le club B, toute la saison. */
const CLUB_B: Reservation = {
  id: "r-club-b",
  resources: [{ id: "gymnase" }],
  resourceIds: ["gymnase"],
  user: "CLUB B",
  slots: [lundi],
  periodStart: "2026-09-01",
  periodEnd: "2027-06-30",
};

let queryClient: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

beforeEach(() => {
  queryClient = new QueryClient();
  ctx.lang = "fr";
  ctx.entity = { id: "site" };
  resourcesReservations.mockReset().mockResolvedValue([CLUB_B]);
});

describe("useBookingChecks — refus d'enregistrer (`beforeSubmit`)", () => {
  it("refuse un créneau pris, sur les réservations RELUES de chaque équipement saisi", async () => {
    const { result } = renderHook(() => useBookingChecks(CONF), { wrapper });

    const refus = await result.current.beforeSubmit(saisie([brut("monday", "18", "20")]));

    expect(refus).toMatch(/^fr:PreviewReservations\.issue\.taken /);
    expect(refus).toContain("CLUB B");
    expect(resourcesReservations).toHaveBeenCalledWith(queryClient, ctx.entity, CONF, ["gymnase"], true);
  });
});

describe("useBookingChecks — avertissement en direct (`slotCheck`)", () => {
  it("un message par créneau, à son index brut, sur les réservations EN CACHE", async () => {
    const { result } = renderHook(() => useBookingChecks(CONF), { wrapper });

    const notices = await result.current.slotCheck(saisie([brut("tuesday", "18", "20"), brut("monday", "18", "20")]));

    const messages = notices[`${STEP}creneaux`];
    expect(messages).toHaveLength(2);
    expect(messages[0]).toBeNull();
    expect(messages[1]).toMatch(/^fr:PreviewReservations\.issue\.taken /);
    expect(resourcesReservations).toHaveBeenCalledWith(queryClient, ctx.entity, CONF, ["gymnase"], false);
  });
});

describe("useBookingChecks — après l'enregistrement (`afterSave`)", () => {
  it("relit les fiches, les fiches organisation et le filtre créneau du formulaire", () => {
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useBookingChecks(CONF), { wrapper });

    result.current.afterSave();

    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["search-reservations", "form-creneaux"] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["search-orga-reservations", "form-creneaux"] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["search-reservation-slots", "form-creneaux"] });
  });
});

describe("useBookingChecks — identité des rappels", () => {
  it("la même d'un rendu à l'autre ; un changement de langue les recrée, messages traduits", async () => {
    const { result, rerender } = renderHook(() => useBookingChecks(CONF), { wrapper });
    const premiers = result.current;

    rerender();
    expect(result.current.beforeSubmit).toBe(premiers.beforeSubmit);
    expect(result.current.slotCheck).toBe(premiers.slotCheck);
    expect(result.current.afterSave).toBe(premiers.afterSave);

    ctx.lang = "en";
    rerender();
    expect(result.current.slotCheck).not.toBe(premiers.slotCheck);
    expect(result.current.beforeSubmit).not.toBe(premiers.beforeSubmit);
    expect(await result.current.beforeSubmit(saisie([brut("monday", "18", "20")]))).toMatch(/^en:/);
  });
});
