// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Reservation, ReservationSlot } from "../lib/reservations";
import type { ReservationsConf } from "../schema";

/**
 * `useUpdateSlotHours` : la fenêtre « Modifier l'horaire ». `submit` contrôle sur les réservations RELUES, puis
 * relit la réponse et ne réécrit que l'élément visé du tableau des créneaux, s'il est toujours celui affiché.
 * `checkLive` (même contrôle, réservations en cache) et `submit` gardent leur identité d'un rendu à l'autre —
 * `checkLive` est une dépendance de l'effet d'avertissement de `SlotHoursDialog` (review de la MR 114).
 */
const ctx = vi.hoisted(() => ({
  lang: "fr",
  entity: { id: "site" } as object | null,
  api: null as { form: (p: { id: string }) => Promise<unknown> } | null,
}));
vi.mock("@/hooks/useCocolight", () => ({ useCocolight: () => ({ entity: ctx.entity, api: ctx.api }) }));
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
vi.mock("@/lib/toastUtils", () => ({ showSuccessToast: vi.fn(), showErrorToast: vi.fn() }));
const resourcesReservations = vi.fn();
vi.mock("./useReservationsQuery", () => ({
  resourcesReservations: (...args: unknown[]) => resourcesReservations(...args),
}));

import { useUpdateSlotHours } from "./useUpdateSlotHours";

const STEP = "etape";
const CONF: ReservationsConf = {
  form: "form-creneaux",
  step: STEP,
  fields: { finder: "equipement", user: "usager", activity: "activite", slots: "creneaux" },
};

const brut = (day: string, sh: string, eh: string) => ({ day, startHour: sh, startMinute: "00", endHour: eh, endMinute: "00" });
/** Le créneau affiché : le lundi 17 h – 19 h, 2e élément (index brut 1) du tableau de la réponse. */
const LUNDI: ReservationSlot = { day: "monday", start: "17:00", end: "19:00", startMinutes: 1020, endMinutes: 1140, index: 1 };
const CLUB_A: Reservation = {
  id: "r-club-a",
  resources: [{ id: "gymnase" }],
  resourceIds: ["gymnase"],
  user: "CLUB A",
  slots: [LUNDI],
  periodStart: "2026-09-01",
  periodEnd: "2027-06-30",
};
/** Le club B tient le lundi 19 h – 21 h du même gymnase. */
const CLUB_B: Reservation = {
  ...CLUB_A,
  id: "r-club-b",
  user: "CLUB B",
  slots: [{ day: "monday", start: "19:00", end: "21:00", startMinutes: 1140, endMinutes: 1260, index: 0 }],
};

let updateField: ReturnType<typeof vi.fn>;
/** La réponse relue avant l'écriture : ses créneaux bruts. */
const reponse = (creneaux: unknown[]) => {
  ctx.api = {
    form: vi.fn(async () => ({
      answer: vi.fn(async () => ({ serverData: { answers: { [STEP]: { [`${STEP}creneaux`]: creneaux } } }, updateField })),
    })),
  };
};

let queryClient: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

/** La fenêtre ouverte sur le créneau du club A. */
const ouvrir = () => {
  const rendu = renderHook(() => useUpdateSlotHours(CONF), { wrapper });
  act(() => rendu.result.current.open(CLUB_A, LUNDI));
  return rendu;
};

beforeEach(() => {
  queryClient = new QueryClient();
  ctx.lang = "fr";
  ctx.entity = { id: "site" };
  updateField = vi.fn().mockResolvedValue(undefined);
  reponse([brut("tuesday", "17", "19"), brut("monday", "17", "19")]);
  resourcesReservations.mockReset().mockResolvedValue([CLUB_A, CLUB_B]);
});

describe("useUpdateSlotHours — enregistrement (`submit`)", () => {
  it("réécrit le seul élément visé du tableau des créneaux, aux nouvelles heures", async () => {
    const { result } = ouvrir();

    let refus: string | null = "non appelé";
    await act(async () => {
      refus = await result.current.submit(17 * 60 + 30, 18 * 60 + 30);
    });

    expect(refus).toBeNull();
    expect(resourcesReservations).toHaveBeenCalledWith(queryClient, ctx.entity, CONF, ["gymnase"], true);
    expect(updateField).toHaveBeenCalledTimes(1);
    expect(updateField).toHaveBeenCalledWith(`answers.${STEP}.${STEP}creneaux.1`, {
      day: "monday",
      startHour: "17",
      startMinute: "30",
      endHour: "18",
      endMinute: "30",
    });
  });

  it("refuse un horaire qui empiète sur un autre club, sans rien écrire", async () => {
    const { result } = ouvrir();

    let refus: string | null = null;
    await act(async () => {
      refus = await result.current.submit(18 * 60, 20 * 60);
    });

    expect(refus).toMatch(/^fr:PreviewReservations\.issue\.taken /);
    expect(refus).toContain("CLUB B");
    expect(updateField).not.toHaveBeenCalled();
  });

  it("créneau périmé : disparu des réservations relues, ou remplacé dans la réponse — rien n'est écrit", async () => {
    resourcesReservations.mockResolvedValue([CLUB_B]);
    const disparu = ouvrir();
    let refus: string | null = null;
    await act(async () => {
      refus = await disparu.result.current.submit(17 * 60 + 30, 18 * 60 + 30);
    });
    expect(refus).toBe("fr:PreviewReservations.issue.stale");

    // Les réservations relues montrent encore le créneau, mais la réponse a changé entre-temps : à l'index 1,
    // un autre créneau. L'écriture par index le réécrirait.
    resourcesReservations.mockResolvedValue([CLUB_A, CLUB_B]);
    reponse([brut("monday", "17", "19"), brut("monday", "08", "10")]);
    const remplace = ouvrir();
    await act(async () => {
      refus = await remplace.result.current.submit(17 * 60 + 30, 18 * 60 + 30);
    });
    expect(refus).toBe("fr:PreviewReservations.issue.stale");
    expect(updateField).not.toHaveBeenCalled();
  });
});

describe("useUpdateSlotHours — avertissement en direct (`checkLive`)", () => {
  it("`checkLive` et `submit` gardent leur identité d'un rendu à l'autre ; la langue les recrée", async () => {
    const { result, rerender } = ouvrir();
    const premiers = result.current;

    rerender();
    expect(result.current.checkLive).toBe(premiers.checkLive);
    expect(result.current.submit).toBe(premiers.submit);

    ctx.lang = "en";
    rerender();
    expect(result.current.checkLive).not.toBe(premiers.checkLive);
    expect(await result.current.checkLive(18 * 60, 20 * 60)).toMatch(/^en:PreviewReservations\.issue\.taken /);
  });
});
