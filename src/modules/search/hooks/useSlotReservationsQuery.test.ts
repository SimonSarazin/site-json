import { describe, it, expect, vi } from "vitest";
import { fetchSlotReservations, slotReservationsQueryKey } from "./useSlotReservationsQuery";
import type { ReservationsConf } from "../schema";
import type { ReservationAnswersHost } from "./useReservationsQuery";

const STEP = "etape";
const conf: ReservationsConf = {
  form: "form1",
  step: STEP,
  fields: { finder: "F", user: "U", userOrga: "O", activity: "A", slots: "S", periodStart: "PS", periodEnd: "PE" },
};

const answer = (poiId: string, orgaId?: string) => ({
  serverData: {
    answers: {
      [STEP]: {
        [`finder${STEP}F`]: { [poiId]: { name: poiId } },
        ...(orgaId ? { [`finder${STEP}O`]: { [orgaId]: { name: orgaId } } } : {}),
        [`${STEP}S`]: [{ day: "monday", startHour: "18", startMinute: "00", endHour: "20", endMinute: "30" }],
        [`${STEP}PS`]: "2026-08-17",
        [`${STEP}PE`]: "2027-08-12",
      },
    },
  },
});
const page = (results: unknown[]) => ({ results, hasNext: false });
const host = (entity: object) => entity as unknown as ReservationAnswersHost;

describe("slotReservationsQueryKey", () => {
  it("un réglage d'AFFICHAGE du bloc réservations ne change pas la clé", () => {
    expect(slotReservationsQueryKey({ ...conf, booking: { adminOnly: false } })).toEqual(slotReservationsQueryKey(conf));
  });

  it("un autre formulaire ou d'autres champs → une autre clé", () => {
    expect(slotReservationsQueryKey({ ...conf, form: "form2" })).not.toEqual(slotReservationsQueryKey(conf));
    expect(slotReservationsQueryKey({ ...conf, fields: { ...conf.fields, slots: "S2" } })).not.toEqual(slotReservationsQueryKey(conf));
  });
});

describe("fetchSlotReservations — réservations qui occupent une ressource", () => {
  it("lit toute réservation qui POINTE une ressource, rattachée à une organisation ou non", async () => {
    const entity = {
      coformAnswersSearch: vi.fn().mockResolvedValue(page([answer("gymnase", "club"), answer("salle")])),
    };
    const reservations = await fetchSlotReservations(host(entity), conf);

    expect(entity.coformAnswersSearch.mock.calls[0][0]).toMatchObject({
      filters: { form: "form1", [`answers.${STEP}.finder${STEP}F`]: { $exists: true } },
    });
    expect(reservations.map((r) => r.resourceIds)).toEqual([["gymnase"], ["salle"]]);
    expect(reservations[1]).toMatchObject({
      periodStart: "2026-08-17",
      periodEnd: "2027-08-12",
      slots: [{ day: "monday", startMinutes: 18 * 60, endMinutes: 20 * 60 + 30 }],
    });
  });
});
