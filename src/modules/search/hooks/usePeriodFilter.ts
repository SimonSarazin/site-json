import { useMemo, useState } from "react";
import { resolvePeriodFilter, type PeriodRange } from "../lib/reservationBooking";

/**
 * Filtre « du … au … » d'une section de réservations (`reservations.periods`), commun aux fiches équipement
 * et organisation : la saisie, et la période APPLIQUÉE (`range`). Une saisie incohérente (fin avant début)
 * est signalée (`filter.invalid`) et la section garde son défaut — en cours ou à venir — plutôt que de tout
 * montrer, saison passée comprise. Sans `enabled`, `range` vaut `null` : la section garde son comportement
 * historique, toutes les réservations.
 */
export function usePeriodFilter(enabled: boolean, today: string) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const resolved = useMemo(
    () => (enabled ? resolvePeriodFilter(from, to, today) : null),
    [enabled, from, to, today],
  );
  const range = useMemo<PeriodRange | null>(
    () => (enabled ? resolved ?? { periodStart: today } : null),
    [enabled, resolved, today],
  );
  return {
    range,
    /** Propriétés de `PeriodFilter`, hors traduction. */
    filter: {
      from,
      to,
      today,
      invalid: resolved === null,
      onFrom: setFrom,
      onTo: setTo,
      onReset: () => {
        setFrom("");
        setTo("");
      },
    },
  };
}
