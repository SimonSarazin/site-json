import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient } from "@tanstack/react-query";

/**
 * `prefetchReservationUsers` : le périmètre « organisations usagères » est préchargé sous la clé
 * que lit `useReservationUsersQuery`, avec l'entité de l'init API de la REQUÊTE (`ensureInitApi`)
 * — jamais une init de plus (garde-fou statique : `tests/preflight/ssr-init-api-unique.test.ts`).
 * En échec, `null` : la page est servie sans le périmètre et le client le calcule lui-même.
 */
const porteur = { id: "porteur" };
const ensureInitApi = vi.fn();
vi.mock("@/lib/cocolightInitQuery", () => ({
  ensureInitApi: (...args: unknown[]) => ensureInitApi(...args),
}));

const fetchReservationUsers = vi.fn();
vi.mock("../../hooks/useReservationUsersQuery", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../hooks/useReservationUsersQuery")>()),
  fetchReservationUsers: (...args: unknown[]) => fetchReservationUsers(...args),
}));

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
  vi.clearAllMocks();
  ensureInitApi.mockResolvedValue({ entity: porteur, api: null });
  fetchReservationUsers.mockResolvedValue(PERIMETRE);
});

describe("prefetchReservationUsers — périmètre usagers préchargé pour le SSR", () => {
  it("lit l'entité de l'init de la requête et remplit la clé du hook", async () => {
    const requete = new QueryClient();

    expect(await prefetchReservationUsers(requete, CONF)).toEqual(PERIMETRE);
    expect(ensureInitApi).toHaveBeenCalledWith(requete);
    expect(fetchReservationUsers).toHaveBeenCalledWith(porteur, CONF);
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
