import { describe, it, expect, vi } from "vitest";
import { fetchReservationUsers, reservationUsersQueryKey } from "./useReservationUsersQuery";
import type { ReservationUsersConf } from "../schema";
import type { ReservationAnswersHost } from "./useReservationsQuery";
import type { PoiSearchHost } from "./useResourcesInPerimeterQuery";

const STEP = "etape";
const conf: ReservationUsersConf = {
  reservations: {
    form: "form1",
    step: STEP,
    fields: { finder: "F", user: "U", userOrga: "O", activity: "A", slots: "S" },
  },
  poiFilters: { type: "recoveryCenter" },
};

const answer = (poiId: string, orgaId?: string) => ({
  serverData: {
    answers: {
      [STEP]: {
        [`finder${STEP}F`]: { [poiId]: { name: poiId } },
        ...(orgaId ? { [`finder${STEP}O`]: { [orgaId]: { name: orgaId } } } : {}),
      },
    },
  },
});
const page = (results: unknown[]) => ({ results, hasNext: false });
const host = (entity: object) => entity as unknown as ReservationAnswersHost & PoiSearchHost;

describe("reservationUsersQueryKey — clé partagée hook + prefetch SSR", () => {
  it("même périmètre → même clé", () => {
    expect(reservationUsersQueryKey(conf)).toEqual(reservationUsersQueryKey({ ...conf }));
  });

  it("un réglage d'AFFICHAGE du bloc réservations (créneaux, prise de réservation) ne change pas la clé", () => {
    const affichage = { ...conf, reservations: { ...conf.reservations, booking: { adminOnly: false } } };
    expect(reservationUsersQueryKey(affichage)).toEqual(reservationUsersQueryKey(conf));
  });

  it("un autre périmètre d'équipements → une autre clé", () => {
    expect(reservationUsersQueryKey({ ...conf, poiFilters: { type: "autre" } })).not.toEqual(reservationUsersQueryKey(conf));
  });

  it("les organisations rattachées au costum élargissent le périmètre → une autre clé", () => {
    expect(reservationUsersQueryKey({ ...conf, includeCostumOrganizations: true })).not.toEqual(reservationUsersQueryKey(conf));
  });
});

describe("fetchReservationUsers — organisations usagères des équipements du site", () => {
  it("lit les réservations RATTACHÉES à une organisation, puis garde celles des équipements du site", async () => {
    const entity = {
      coformAnswersSearch: vi.fn().mockResolvedValue(
        page([answer("gymnase-lycee", "club-b"), answer("salle-municipale", "club-a"), answer("gymnase-lycee", "club-b")]),
      ),
      // Le site ne retient que l'équipement scolaire.
      searchCostum: vi.fn().mockResolvedValue(page([{ id: "gymnase-lycee" }])),
    };
    const r = await fetchReservationUsers(host(entity), conf);

    expect(entity.coformAnswersSearch.mock.calls[0][0]).toMatchObject({
      filters: { form: "form1", [`answers.${STEP}.finder${STEP}O`]: { $exists: true } },
    });
    expect(entity.searchCostum.mock.calls[0][0]).toMatchObject({
      filters: { type: "recoveryCenter", _id: { $in: ["gymnase-lycee", "salle-municipale"] } },
    });
    expect(r).toEqual({ orgIds: ["club-b"], resourceIds: ["gymnase-lycee"] });
  });

  it("avec includeCostumOrganizations : les organisations rattachées au costum s'ajoutent, sans doublon", async () => {
    const entity = {
      coformAnswersSearch: vi.fn().mockResolvedValue(page([answer("gymnase-lycee", "club-b")])),
      // Rattachées au costum : une association ajoutée depuis l'annuaire, sans créneau, et un club déjà usager.
      searchCostum: vi.fn(async ({ searchType }: { searchType: string[] }) =>
        searchType[0] === "organizations" ? page([{ id: "asso-nouvelle" }, { id: "club-b" }]) : page([{ id: "gymnase-lycee" }]),
      ),
    };
    const r = await fetchReservationUsers(host(entity), { ...conf, includeCostumOrganizations: true });

    expect(r).toEqual({ orgIds: ["asso-nouvelle", "club-b"], resourceIds: ["gymnase-lycee"] });
    // Ni filtre ni sourceKey : c'est le SDK qui scope la recherche au costum du site.
    const orgas = entity.searchCostum.mock.calls.map(([p]) => p).find((p) => p.searchType[0] === "organizations");
    expect(orgas).toBeDefined();
    expect(orgas).not.toHaveProperty("filters");
    expect(orgas).not.toHaveProperty("sourceKey");
  });

  it("aucune réservation → aucun appel de recherche d'équipements, périmètre vide", async () => {
    const entity = {
      coformAnswersSearch: vi.fn().mockResolvedValue(page([])),
      searchCostum: vi.fn(),
    };
    expect(await fetchReservationUsers(host(entity), conf)).toEqual({ orgIds: [], resourceIds: [] });
    expect(entity.searchCostum).not.toHaveBeenCalled();
  });
});
