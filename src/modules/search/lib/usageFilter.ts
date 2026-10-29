import { computePoiUsage, type UsageConf, type UsageStatus } from "@/modules/observatoire/usage";
import type { Reservation } from "./reservations";
import { EXCLUDE_TYPE, INCLUDE_TYPE } from "./searchByFieldsToQuery";

/**
 * Logique PURE du filtre « Statut d'ouverture » du bandeau (`searchHeader.usageFilter`) : un statut choisi —
 * ouvert, non ouvert, sans planning (`observatoire/usage.ts`) — devient une entrée calculée sur `_id`,
 * publiée comme celle du filtre créneau (`withSlotEntry`).
 *
 * Seuls les équipements PRÉSENTS dans les réservations ont un statut calculable ; tous les autres sont
 * « sans planning ». D'où : « ouvert » ou « non ouvert » → `$in` des équipements de ce statut ; « sans
 * planning » → `$nin` des équipements qui ont un créneau en cours ou à venir.
 */

export const USAGE_STATUSES: readonly UsageStatus[] = ["open", "closed", "noPlanning"];

/** Identifiants de base seulement : un identifiant de démo ou abîmé ferait échouer la requête. */
const OBJECT_ID = /^[0-9a-f]{24}$/i;

/** Statut lu dans l'URL ; valeur inconnue (lien abîmé) → `null`, comme un filtre absent. */
export function statusFromParam(raw: string | null): UsageStatus | null {
  return USAGE_STATUSES.find((s) => s === raw) ?? null;
}

/** Entrée du filtre pour `status` : type (`$in` / `$nin`) et identifiants triés. */
export function usageFilterClause(
  reservations: readonly Reservation[],
  status: UsageStatus,
  today: string,
  orgTypes: ReadonlyMap<string, string>,
  conf: UsageConf,
): { type: typeof INCLUDE_TYPE | typeof EXCLUDE_TYPE; ids: string[] } {
  const ids = [...new Set(reservations.flatMap((r) => r.resourceIds))].filter((id) => OBJECT_ID.test(id)).sort();
  const usage = computePoiUsage(reservations, ids, today, orgTypes, conf);
  if (status === "noPlanning") {
    return { type: EXCLUDE_TYPE, ids: ids.filter((id) => usage.get(id)?.status !== "noPlanning") };
  }
  // Aucun équipement de ce statut : liste vide, que le traducteur rend par un identifiant qui n'existe pas.
  return { type: INCLUDE_TYPE, ids: ids.filter((id) => usage.get(id)?.status === status) };
}
