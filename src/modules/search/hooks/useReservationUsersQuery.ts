import { useCallback } from "react";
import { useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { useCocolight } from "@/hooks/useCocolight";
import { SEARCH_QUERY_KEYS } from "../constants/queryKeys";
import { reservationUserIds, reservedResourceIds, withCostumOrganizations } from "../lib/reservationUsers";
import type { ReservationUsersConf } from "../schema";
import { SEARCH_ALL_DEFAULT_MAX_RESULTS } from "./useSearchAllResults";
import { fetchReservationAnswers, type ReservationAnswersHost } from "./useReservationsQuery";
import { fetchResourceIdsInPerimeter, searchCostumIds, type PoiSearchHost } from "./useResourcesInPerimeterQuery";

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
    // Absent → `undefined`, que le hachage de la clé ignore : la clé des listes sans l'option ne bouge pas.
    includeCostumOrganizations: conf.includeCostumOrganizations,
  });
}

/** Organisations RATTACHÉES au costum du site : `source.keys` ou `reference.costum` (sourceKey du SDK). */
async function fetchCostumOrganizationIds(entity: PoiSearchHost): Promise<string[]> {
  return [...(await searchCostumIds(entity, { searchType: ["organizations"] }))];
}

/**
 * Fetcher partagé hook + prefetch SSR : TOUTES les réservations rattachées à une organisation
 * (plafond {@link SEARCH_ALL_DEFAULT_MAX_RESULTS} — un périmètre amputé en silence retirerait des
 * organisations), puis, parmi les équipements qu'elles pointent, ceux du périmètre du site — un
 * seul appel `_id: {$in}`, borné par le nombre d'équipements réservés et non par le parc. Avec
 * `includeCostumOrganizations`, les organisations rattachées au costum s'y ajoutent — recherchées en
 * même temps que les réservations, pour ne pas allonger le rendu serveur.
 */
export async function fetchReservationUsers(
  entity: ReservationAnswersHost & PoiSearchHost,
  conf: ReservationUsersConf,
): Promise<ReservationUsers> {
  const { step, fields } = conf.reservations;
  const [reservations, costumOrgIds] = await Promise.all([
    fetchReservationAnswers(
      entity,
      conf.reservations,
      { [`answers.${step}.finder${step}${fields.userOrga}`]: { $exists: true } },
      SEARCH_ALL_DEFAULT_MAX_RESULTS,
    ),
    conf.includeCostumOrganizations ? fetchCostumOrganizationIds(entity) : null,
  ]);
  const resourceIds = await fetchResourceIdsInPerimeter(entity, reservedResourceIds(reservations), conf);
  const userIds = reservationUserIds(reservations, new Set(resourceIds));
  return { orgIds: costumOrgIds ? withCostumOrganizations(userIds, costumOrgIds) : userIds, resourceIds };
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

/**
 * Organisation tout juste créée par le bouton « Ajouter » de la section : elle rejoint le périmètre
 * AUSSITÔT, sans attendre sa relecture — qui relit toutes les réservations et peut prendre plusieurs
 * secondes. Le formulaire invalide aussi le périmètre (`searchKeys`) : la relecture, en arrière-plan,
 * confirme. Sans `includeCostumOrganizations`, rien : l'organisation n'appartiendrait pas au périmètre.
 */
export function useAddCostumOrganization(conf: ReservationUsersConf | undefined) {
  const queryClient = useQueryClient();
  return useCallback(
    (created: { id?: string | null }) => {
      const id = created.id;
      if (!conf?.includeCostumOrganizations || !id) return;
      queryClient.setQueryData<ReservationUsers>(reservationUsersQueryKey(conf), (old) =>
        old ? { ...old, orgIds: withCostumOrganizations(old.orgIds, [id]) } : old,
      );
    },
    [conf, queryClient],
  );
}
