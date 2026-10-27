import type { QueryClient } from "@tanstack/react-query";
import { ensureInitApi } from "@/lib/cocolightInitQuery";
import {
  fetchReservationPerimeter,
  fetchReservationUsers,
  reservationUsersQueryKey,
  type ReservationUsers,
} from "../hooks/useReservationUsersQuery";
import type { ReservationUsersConf } from "../schema";
import { facetCache } from "./facetCache";

/**
 * Pré-charge le périmètre « organisations usagères » d'une liste (`searchProStatic.reservationUsers`)
 * pour le SSR — hydrate React Query avec la même `queryKey` que `useReservationUsersQuery`, ce qui
 * permet de précharger la liste DÉJÀ restreinte. `null` en cas d'échec : la liste n'est alors pas
 * préchargée et le client calcule le périmètre lui-même (squelette au SSR comme au 1er rendu).
 *
 * L'entité vient de l'init API de la REQUÊTE (`ensureInitApi`), partagée avec entry-server et les
 * autres loaders : un `initApi()` direct referait la résolution du porteur à chaque page servie.
 *
 * La partie LOURDE du périmètre (`fetchReservationPerimeter` : toutes les réservations, par pages en
 * série, puis leurs équipements du site) passe par le mémo serveur des facettes (`facetCache`, 5 min
 * par défaut) : sans lui, chaque rendu la relisait avant le début du streaming. Sa clé est celle de la
 * liste SANS `includeCostumOrganizations` ; les organisations rattachées au costum restent lues à
 * chaque rendu, si bien qu'une association ajoutée apparaît dès le rechargement. Limite : un club
 * hors costum n'entre au rendu serveur qu'au renouvellement du mémo, au plus tard une durée de vie
 * après son premier créneau — le client, lui, lit toujours le périmètre au backend.
 */
export async function prefetchReservationUsers(
  queryClient: QueryClient,
  conf: ReservationUsersConf,
): Promise<ReservationUsers | null> {
  try {
    return await queryClient.ensureQueryData({
      queryKey: reservationUsersQueryKey(conf),
      queryFn: async () => {
        const { entity } = await ensureInitApi(queryClient);
        if (!entity) throw new Error("entité du site non initialisée");
        return fetchReservationUsers(entity, conf, (host, c) =>
          facetCache.get(
            JSON.stringify(["reservation-users", reservationUsersQueryKey({ ...c, includeCostumOrganizations: undefined })]),
            () => fetchReservationPerimeter(host, c),
          ),
        );
      },
    });
  } catch (error) {
    console.error("Erreur préchargement reservationUsers:", error);
    return null;
  }
}
