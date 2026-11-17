import { useMemo } from "react";
import { orgaBookedHours, orgaReservationsIndex } from "../lib/reservationHours";
import { localIsoDay } from "../lib/slotFilter";
import type { BookedResourcesConf, ReservationsConf } from "../schema";
import { useResourcesInPerimeterQuery } from "./useResourcesInPerimeterQuery";
import { useSlotReservationsQuery } from "./useSlotReservationsQuery";

/** Aucun équipement réservé tant que rien n'est lu — une référence stable pour la clé du contrôle de périmètre. */
const AUCUN: string[] = [];

/**
 * Heures d'une organisation pour sa CARTE dans l'annuaire (`card.bookedHours`) — le total que sa fiche affiche à
 * l'ouverture (`orgaBookedHours`). Une carte par organisation, mais une seule lecture pour la page : toutes les
 * réservations du formulaire (même requête, en cache, que le filtre « Créneau disponible »), puis UN contrôle de
 * périmètre sur tous les équipements réservés (`bookedResources.poiFilters`) — la même clé pour toutes les cartes.
 * Sans `conf` : aucune requête, `hours` absent.
 */
export function useOrgaBookedHours(
  orgaId: string | undefined,
  conf: ReservationsConf | undefined,
  booked: BookedResourcesConf | undefined,
) {
  const active = Boolean(conf && orgaId);
  const { data, isError } = useSlotReservationsQuery(conf, active);
  // Index partagé par toutes les cartes de la page (`orgaReservationsIndex`) : équipements réservés tirés une fois.
  const reservedIds = data ? orgaReservationsIndex(data).reservedIds : AUCUN;
  const perimetre = useResourcesInPerimeterQuery(reservedIds, active ? booked : undefined);
  const today = useMemo(() => localIsoDay(new Date()), []);
  const periods = Boolean(conf?.periods);
  // En attente tant que les réservations ne sont pas lues (requête pas encore partie au rendu serveur, ou en vol),
  // puis pendant le contrôle de périmètre : jamais un « — » ou un 0 avant le calcul.
  const waiting = (!data && !isError) || perimetre.isLoading;

  const hours = useMemo(
    () => (data && orgaId && !waiting ? orgaBookedHours(data, orgaId, perimetre.allowed, today, periods) : undefined),
    [data, orgaId, waiting, perimetre.allowed, today, periods],
  );
  return {
    hours,
    loading: active && waiting,
    failed: active && ((isError && !data) || perimetre.isError),
  };
}
