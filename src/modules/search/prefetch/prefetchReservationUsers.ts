import type { QueryClient } from "@tanstack/react-query";
import { ensureInitApi } from "@/lib/cocolightInitQuery";
import {
  fetchReservationUsers,
  reservationUsersQueryKey,
  type ReservationUsers,
} from "../hooks/useReservationUsersQuery";
import type { ReservationUsersConf } from "../schema";

/**
 * Pré-charge le périmètre « organisations usagères » d'une liste (`searchProStatic.reservationUsers`)
 * pour le SSR — hydrate React Query avec la même `queryKey` que `useReservationUsersQuery`, ce qui
 * permet de précharger la liste DÉJÀ restreinte. `null` en cas d'échec : la liste n'est alors pas
 * préchargée et le client calcule le périmètre lui-même (squelette au SSR comme au 1er rendu).
 *
 * L'entité vient de l'init API de la REQUÊTE (`ensureInitApi`), partagée avec entry-server et les
 * autres loaders : un `initApi()` direct referait la résolution du porteur à chaque page servie.
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
        return fetchReservationUsers(entity, conf);
      },
    });
  } catch (error) {
    console.error("Erreur préchargement reservationUsers:", error);
    return null;
  }
}
