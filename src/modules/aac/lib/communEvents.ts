import type { Event } from "@communecter/cocolight-api-client";
import { formatDate } from "@/helpers/formatDate";
import { eventOccurrence } from "@/modules/agenda/lib/eventDates";
import { eventTimeBucket } from "@/modules/agenda/lib/partitionByTime";
import { formatRecurrenceLabel, type Translate } from "@/modules/search/lib/openingHoursDays";

/** Une ligne de l'agenda d'un commun, prête à afficher. */
export interface CommunEventRow {
  id: string;
  name: string;
  /** `null` : pas de fiche vers laquelle lier. */
  slug: string | null;
  /** Libellé de récurrence (« Chaque vendredi ») sinon date et heure de l'occurrence ; `""` sans date. */
  when: string;
  locality: string | null;
  isOngoing: boolean;
}

function nonEmpty(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

/** Lit un événement pour l'agenda d'un commun. `tSearch` : `useT("modules/search")` (libellé de récurrence). */
export function toCommunEventRow(
  event: Pick<Event, "id" | "serverData">,
  now: Date,
  tSearch: Translate,
): CommunEventRow {
  const sd = (event.serverData ?? {}) as Record<string, unknown>;
  const { start, end } = eventOccurrence(event);
  const recurrence = formatRecurrenceLabel(sd.recurrency, sd.openingHours, tSearch);
  const address = (sd.address ?? {}) as { addressLocality?: unknown };

  return {
    id: String(event.id ?? ""),
    name: nonEmpty(sd.name) ?? "",
    slug: nonEmpty(sd.slug),
    when: recurrence ?? (start ? formatDate(start) : ""),
    locality: nonEmpty(address.addressLocality),
    isOngoing: start ? eventTimeBucket(start, end, now) === "ongoing" : false,
  };
}
