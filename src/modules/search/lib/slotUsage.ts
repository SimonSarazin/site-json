import { plannedRates, plannedResourceIds } from "@/modules/observatoire/usage";
import type { Reservation } from "./reservations";
import type { ReservationsConf } from "../schema";

/**
 * Créneaux des équipements d'une page de liste : lesquels ont un planning (un créneau en cours ou à venir), et
 * leur taux d'occupation. Lus par la bande et le taux des cartes (`card.slotsBand`), la légende et le tri de la
 * liste (`usageSort`) — une seule règle, celle du « sans planning » de la mesure d'usage.
 */
export interface SlotUsage {
  planned: ReadonlySet<string>;
  /** Taux (part de la plage de référence) des équipements qui ont un planning. Vide sans `reservations.usage` :
   *  sans plage de référence, pas de taux. */
  rates: ReadonlyMap<string, number>;
}

const SANS_TAUX: ReadonlyMap<string, number> = new Map();

/** Dernier calcul par tableau de réservations : le cache de React Query rend le MÊME tableau à toutes les cartes
 *  d'une page. Sans ce mémo, chacune refaisait la mesure du parc entier. */
const memo = new WeakMap<readonly Reservation[], { key: string; usage: SlotUsage }>();

/** Mesure des créneaux au jour `today`. Même tableau, même jour, même plage : le résultat déjà calculé. */
export function slotUsageOf(reservations: readonly Reservation[], today: string, conf: ReservationsConf): SlotUsage {
  const key = `${today}|${JSON.stringify(conf.usage?.referenceAmplitude ?? null)}`;
  const hit = memo.get(reservations);
  if (hit?.key === key) return hit.usage;
  const planned = plannedResourceIds(reservations, today);
  const usage: SlotUsage = {
    planned,
    rates: conf.usage ? plannedRates(reservations, planned, today, conf.usage) : SANS_TAUX,
  };
  memo.set(reservations, { key, usage });
  return usage;
}
