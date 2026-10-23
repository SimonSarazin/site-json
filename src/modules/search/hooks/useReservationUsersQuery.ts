import { useQuery, type QueryKey } from "@tanstack/react-query";
import { useCocolight } from "@/hooks/useCocolight";
import { SEARCH_QUERY_KEYS } from "../constants/queryKeys";
import { reservationUserIds, reservedResourceIds } from "../lib/reservationUsers";
import type { ReservationUsersConf } from "../schema";
import { SEARCH_ALL_DEFAULT_MAX_RESULTS } from "./useSearchAllResults";
import { fetchReservationAnswers, type ReservationAnswersHost } from "./useReservationsQuery";
import { fetchResourceIdsInPerimeter, type PoiSearchHost } from "./useResourcesInPerimeterQuery";

/** Périmètre calculé : organisations retenues et équipements du site réservés (triés). */
export interface ReservationUsers {
  orgIds: string[];
  resourceIds: string[];
}

/**
 * QueryKey partagée hook + prefetch SSR. Seuls les éléments qui changent le résultat y entrent
 * (pas `fields.slots`, `booking`…), pour que deux blocs `reservations` différents par leur seul
 * affichage partagent le même cache.
 */
export function reservationUsersQueryKey(conf: ReservationUsersConf): QueryKey {
  const { form, step, fields } = conf.reservations;
  return SEARCH_QUERY_KEYS.RESERVATION_USERS(form, {
    step,
    finder: fields.finder,
    userOrga: fields.userOrga,
    poiFilters: conf.poiFilters,
    sourceKey: conf.sourceKey,
  });
}

/**
 * Fetcher partagé hook + prefetch SSR : TOUTES les réservations rattachées à une organisation
 * (plafond {@link SEARCH_ALL_DEFAULT_MAX_RESULTS} — un périmètre amputé en silence retirerait des
 * organisations), puis, parmi les équipements qu'elles pointent, ceux du périmètre du site — un
 * seul appel `_id: {$in}`, borné par le nombre d'équipements réservés et non par le parc.
 */
export async function fetchReservationUsers(
  entity: ReservationAnswersHost & PoiSearchHost,
  conf: ReservationUsersConf,
): Promise<ReservationUsers> {
  const { step, fields } = conf.reservations;
  const reservations = await fetchReservationAnswers(
    entity,
    conf.reservations,
    { [`answers.${step}.finder${step}${fields.userOrga}`]: { $exists: true } },
    SEARCH_ALL_DEFAULT_MAX_RESULTS,
  );
  const resourceIds = await fetchResourceIdsInPerimeter(entity, reservedResourceIds(reservations), conf);
  return { orgIds: reservationUserIds(reservations, new Set(resourceIds)), resourceIds };
}

/**
 * Périmètre « organisations usagères » d'une liste (`searchProStatic.reservationUsers`). Sans conf
 * → aucun appel. Préchargé au SSR avec la MÊME clé (`prefetchReservationUsers`) : la liste servie
 * est déjà la bonne, et l'hydratation n'en refait aucun appel.
 */
export function useReservationUsersQuery(conf: ReservationUsersConf | undefined) {
  const { entity } = useCocolight();
  return useQuery<ReservationUsers>({
    queryKey: conf ? reservationUsersQueryKey(conf) : SEARCH_QUERY_KEYS.RESERVATION_USERS("", {}),
    enabled: Boolean(entity && conf),
    staleTime: 5 * 60 * 1000,
    queryFn: () => {
      if (!entity || !conf) return { orgIds: [], resourceIds: [] };
      return fetchReservationUsers(entity, conf);
    },
  });
}
