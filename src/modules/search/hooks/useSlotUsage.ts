import { useMemo } from "react";
import { slotUsageOf } from "../lib/slotUsage";
import { localIsoDay } from "../lib/slotFilter";
import type { ReservationsConf } from "../schema";
import { useSlotReservationsQuery } from "./useSlotReservationsQuery";

/**
 * Créneaux des équipements d'une page de liste (`slotUsageOf`) : la bande et le taux des cartes (`card.slotsBand`),
 * la légende et le tri de la liste (`usageSort`). Les réservations de la fiche en UNE requête, partagée par toutes
 * les cartes — la même, en cache, que le filtre « Créneau disponible » et l'observatoire. Sans `conf` ou sans
 * `enabled` : aucune requête, `usage` absent.
 */
export function useSlotUsage(conf: ReservationsConf | undefined, enabled = true) {
  const active = Boolean(conf) && enabled;
  const { data, isError, refetch } = useSlotReservationsQuery(conf, active);
  const today = useMemo(() => localIsoDay(new Date()), []);
  const usage = useMemo(() => (data && conf ? slotUsageOf(data, today, conf) : undefined), [data, conf, today]);
  return {
    usage,
    // En attente tant que rien n'est lu, et non seulement pendant la requête : au rendu serveur, elle n'est pas encore
    // partie — un « — » ou une légende sans sablier y diraient « aucun créneau » à tort.
    loading: active && !data && !isError,
    /** Échec SANS réservations lues — un rafraîchissement qui échoue garde celles déjà là. */
    failed: active && isError && !data,
    refetch,
  };
}
