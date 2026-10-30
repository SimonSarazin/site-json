import { useQuery, type QueryKey } from "@tanstack/react-query";
import { useCocolight } from "@/hooks/useCocolight";
import { SEARCH_QUERY_KEYS } from "../constants/queryKeys";
import type { Reservation } from "../lib/reservations";
import type { ReservationsConf } from "../schema";
import { SEARCH_ALL_DEFAULT_MAX_RESULTS } from "./useSearchAllResults";
import { fetchReservationAnswers, type ReservationAnswersHost } from "./useReservationsQuery";

/** QueryKey : le formulaire, l'étape et les champs lus — `booking`, `orgaLink`… ne changent rien
 *  aux réservations chargées. */
export function slotReservationsQueryKey(conf: ReservationsConf): QueryKey {
  return SEARCH_QUERY_KEYS.RESERVATION_SLOTS(conf.form, { step: conf.step, fields: conf.fields });
}

/**
 * TOUTES les réservations du formulaire qui pointent une ressource (finder renseigné), rattachées à
 * une organisation ou non : une réservation saisie au seul nom d'usager occupe le créneau tout autant.
 * Plafond {@link SEARCH_ALL_DEFAULT_MAX_RESULTS} : un jeu tronqué rendrait « libres » des équipements
 * occupés.
 */
export function fetchSlotReservations(
  entity: ReservationAnswersHost,
  conf: ReservationsConf,
): Promise<Reservation[]> {
  const { step, fields } = conf;
  return fetchReservationAnswers(
    entity,
    conf,
    { [`answers.${step}.finder${step}${fields.finder}`]: { $exists: true } },
    SEARCH_ALL_DEFAULT_MAX_RESULTS,
  );
}

/**
 * Réservations lues par le filtre créneau (`searchHeader.slotFilter`) et par le KPI
 * `reservationHours` de l'observatoire. Chargées à la DEMANDE (`enabled` : filtre ouvert, créneau
 * dans l'URL, ou KPI déclaré), jamais pour le seul affichage d'une page de recherche — la plupart
 * des visites n'utilisent pas le filtre.
 */
export function useSlotReservationsQuery(conf: ReservationsConf | undefined, enabled: boolean) {
  const { entity } = useCocolight();
  return useQuery<Reservation[]>({
    queryKey: conf ? slotReservationsQueryKey(conf) : SEARCH_QUERY_KEYS.RESERVATION_SLOTS("", {}),
    enabled: Boolean(entity && conf && enabled),
    staleTime: 5 * 60 * 1000,
    queryFn: () => {
      if (!entity || !conf) return [];
      return fetchSlotReservations(entity, conf);
    },
  });
}
