import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient } from "@tanstack/react-query";

/**
 * `prefetchReservationUsers` : le périmètre « organisations usagères » est préchargé sous la clé
 * que lit `useReservationUsersQuery`, avec l'entité de l'init API de la REQUÊTE (`ensureInitApi`)
 * — jamais une init de plus (garde-fou statique : `tests/preflight/ssr-init-api-unique.test.ts`).
 * En échec, `null` : la page est servie sans le périmètre et le client le calcule lui-même.
 * La partie lourde (réservations et équipements) passe par le mémo serveur `facetCache` ; les
 * organisations rattachées au costum, non : une association ajoutée apparaît au rendu suivant.
 */
const porteur = { id: "porteur" };
const ensureInitApi = vi.fn();
vi.mock("@/lib/cocolightInitQuery", () => ({
  ensureInitApi: (...args: unknown[]) => ensureInitApi(...args),
}));

const fetchReservationUsers = vi.fn();
const fetchReservationPerimeter = vi.fn();
vi.mock("../../hooks/useReservationUsersQuery", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../hooks/useReservationUsersQuery")>()),
  fetchReservationUsers: (...args: unknown[]) => fetchReservationUsers(...args),
  fetchReservationPerimeter: (...args: unknown[]) => fetchReservationPerimeter(...args),
}));

// Un mémo PROPRE au test (idiome de `prefetchFilters.test.ts`) : l'instance réelle lit
// `SSR_FACET_CACHE_TTL_MS` dans le shell du développeur (`0` = passe-plat).
vi.mock("../facetCache", async () => {
  const { createSsrMemo } = await import("@/lib/ssrMemo");
  return { facetCache: createSsrMemo({ ttlMs: 60_000 }) };
});
import { facetCache } from "../facetCache";
import { prefetchReservationUsers } from "../prefetchReservationUsers";
import { reservationUsersQueryKey } from "../../hooks/useReservationUsersQuery";
import type { ReservationUsersConf } from "../../schema";

const CONF: ReservationUsersConf = {
  reservations: {
    form: "form-creneaux",
    step: "etape",
    fields: { finder: "equipement", user: "usager", userOrga: "club", activity: "activite", slots: "creneaux" },
  },
  poiFilters: { type: "recoveryCenter" },
};
const PERIMETRE = { orgIds: ["club-a"], resourceIds: ["salle-1"] };

beforeEach(() => {
  facetCache.clear();
  vi.clearAllMocks();
  ensureInitApi.mockResolvedValue({ entity: porteur, api: null });
  fetchReservationUsers.mockResolvedValue(PERIMETRE);
});

describe("prefetchReservationUsers — périmètre usagers préchargé pour le SSR", () => {
  it("lit l'entité de l'init de la requête et remplit la clé du hook", async () => {
    const requete = new QueryClient();

    expect(await prefetchReservationUsers(requete, CONF)).toEqual(PERIMETRE);
    expect(ensureInitApi).toHaveBeenCalledWith(requete);
    // 3e argument : la lecture de la partie lourde par le mémo serveur.
    expect(fetchReservationUsers).toHaveBeenCalledWith(porteur, CONF, expect.any(Function));
    expect(requete.getQueryData(reservationUsersQueryKey(CONF))).toEqual(PERIMETRE);
  });

  it("entité absente → null et rien en cache : le client calculera le périmètre", async () => {
    ensureInitApi.mockResolvedValue({ entity: null, api: null });
    const erreur = vi.spyOn(console, "error").mockImplementation(() => {});
    const requete = new QueryClient();

    expect(await prefetchReservationUsers(requete, CONF)).toBeNull();
    expect(fetchReservationUsers).not.toHaveBeenCalled();
    expect(requete.getQueryData(reservationUsersQueryKey(CONF))).toBeUndefined();
    erreur.mockRestore();
  });

  it("backend en échec → null, sans faire échouer la page", async () => {
    fetchReservationUsers.mockRejectedValue(new Error("503"));
    const erreur = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(await prefetchReservationUsers(new QueryClient(), CONF)).toBeNull();
    expect(erreur).toHaveBeenCalled();
    erreur.mockRestore();
  });
});

describe("prefetchReservationUsers — mémo serveur de la partie lourde", () => {
  // Chaque `QueryClient` est un rendu serveur distinct (un par requête, comme `entry-server`) ; le
  // mémo, lui, est au niveau du processus.
  const AVEC_COSTUM: ReservationUsersConf = { ...CONF, includeCostumOrganizations: true };
  let rattachees: string[];
  const site = {
    searchCostum: vi.fn(async () => ({ results: rattachees.map((id) => ({ id })), hasNext: false })),
  };

  beforeEach(async () => {
    const reel = await vi.importActual<typeof import("../../hooks/useReservationUsersQuery")>(
      "../../hooks/useReservationUsersQuery",
    );
    fetchReservationUsers.mockImplementation(reel.fetchReservationUsers);
    fetchReservationPerimeter.mockResolvedValue(PERIMETRE);
    ensureInitApi.mockResolvedValue({ entity: site, api: null });
    rattachees = ["club-a"];
  });

  it("deux rendus : les réservations lues une fois, les organisations du costum à chaque rendu", async () => {
    await prefetchReservationUsers(new QueryClient(), AVEC_COSTUM);
    await prefetchReservationUsers(new QueryClient(), AVEC_COSTUM);

    expect(fetchReservationPerimeter).toHaveBeenCalledTimes(1);
    expect(fetchReservationPerimeter).toHaveBeenCalledWith(site, AVEC_COSTUM);
    expect(site.searchCostum).toHaveBeenCalledTimes(2);
  });

  it("une association ajoutée entre deux rendus apparaît au second", async () => {
    expect(await prefetchReservationUsers(new QueryClient(), AVEC_COSTUM)).toEqual(PERIMETRE);
    rattachees = ["asso-nouvelle", "club-a"];

    expect(await prefetchReservationUsers(new QueryClient(), AVEC_COSTUM)).toEqual({
      orgIds: ["asso-nouvelle", "club-a"],
      resourceIds: ["salle-1"],
    });
    expect(fetchReservationPerimeter).toHaveBeenCalledTimes(1);
  });

  it("avec ou sans les organisations du costum, une seule entrée ; un autre périmètre, une autre", async () => {
    await prefetchReservationUsers(new QueryClient(), CONF);
    await prefetchReservationUsers(new QueryClient(), AVEC_COSTUM);
    expect(fetchReservationPerimeter).toHaveBeenCalledTimes(1);

    await prefetchReservationUsers(new QueryClient(), { ...CONF, poiFilters: { type: "autre" } });
    expect(fetchReservationPerimeter).toHaveBeenCalledTimes(2);
    expect(facetCache.size).toBe(2);
  });
});
