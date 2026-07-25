import type { Reservation } from "@/modules/search/lib/reservations";

/**
 * Logique PURE du tableau de bord d'installation (modal ouverte depuis le
 * détail `poi-amenities`) : agrégation des créneaux de réservation par
 * équipement, taux d'utilisation vs amplitude de référence, répartition des
 * activités. Zéro import React — testable comme `dashboard.ts`.
 *
 * Le parsing des answers vit dans `search/lib/reservations.ts` (helper partagé
 * avec la section réservations du preview) — ici on ne fait qu'agréger.
 */

export interface ReferenceAmplitude {
  startHour: number;
  endHour: number;
  days: number;
}

/** Amplitude hebdo de référence en minutes — bornée ≥ 0 (garde division par
 *  zéro pour une config `endHour ≤ startHour`). */
export function weeklyAmplitudeMinutes(a: ReferenceAmplitude): number {
  return Math.max(0, (a.endHour - a.startHour) * 60 * a.days);
}

/**
 * Fusionne des intervalles `[start, end)` (minutes) qui se chevauchent ou se
 * touchent — évite le double comptage quand deux usagers réservent le même
 * créneau (sinon le taux d'utilisation dépasse artificiellement 100 %).
 */
export function mergeIntervals(
  intervals: ReadonlyArray<readonly [number, number]>,
): Array<[number, number]> {
  const sorted = intervals
    .filter(([start, end]) => end > start)
    .map(([start, end]) => [start, end] as [number, number])
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);

  const merged: Array<[number, number]> = [];
  for (const [start, end] of sorted) {
    const last = merged[merged.length - 1];
    if (last && start <= last[1]) last[1] = Math.max(last[1], end);
    else merged.push([start, end]);
  }
  return merged;
}

export interface EquipmentUsage {
  /** Somme brute des durées de créneaux (min/sem). */
  reservedMinutes: number;
  /** Minutes OCCUPÉES après fusion des chevauchements par jour — base du taux. */
  occupiedMinutes: number;
  slotCount: number;
  activities: string[];
}

/**
 * Agrège les réservations par équipement (`Reservation.resourceIds` ∩
 * `poiIds`). Chaque poiId reçoit une entrée, même sans réservation (zéros) ;
 * les ids pointés par les answers mais hors installation sont ignorés.
 */
export function computeEquipmentUsage(
  reservations: readonly Reservation[],
  poiIds: readonly string[],
): Map<string, EquipmentUsage> {
  const known = new Set(poiIds);
  const usage = new Map<string, EquipmentUsage>(
    poiIds.map((id) => [
      id,
      { reservedMinutes: 0, occupiedMinutes: 0, slotCount: 0, activities: [] },
    ]),
  );
  // Intervalles par (équipement, jour) pour la fusion des chevauchements.
  const intervalsByPoi = new Map<string, Map<string, Array<[number, number]>>>();
  const activitiesByPoi = new Map<string, Set<string>>();

  for (const r of reservations) {
    for (const poiId of r.resourceIds) {
      if (!known.has(poiId)) continue;
      const u = usage.get(poiId)!;
      for (const slot of r.slots) {
        u.reservedMinutes += Math.max(0, slot.endMinutes - slot.startMinutes);
        u.slotCount += 1;
        let byDay = intervalsByPoi.get(poiId);
        if (!byDay) intervalsByPoi.set(poiId, (byDay = new Map()));
        let dayIntervals = byDay.get(slot.day);
        if (!dayIntervals) byDay.set(slot.day, (dayIntervals = []));
        dayIntervals.push([slot.startMinutes, slot.endMinutes]);
      }
      if (r.activity) {
        let acts = activitiesByPoi.get(poiId);
        if (!acts) activitiesByPoi.set(poiId, (acts = new Set()));
        acts.add(r.activity);
      }
    }
  }

  for (const [poiId, byDay] of intervalsByPoi) {
    const u = usage.get(poiId)!;
    for (const dayIntervals of byDay.values()) {
      u.occupiedMinutes += mergeIntervals(dayIntervals).reduce(
        (sum, [start, end]) => sum + (end - start),
        0,
      );
    }
  }
  for (const [poiId, acts] of activitiesByPoi) {
    usage.get(poiId)!.activities = [...acts].sort((a, b) => a.localeCompare(b, "fr"));
  }
  return usage;
}

/** Taux ∈ [0, +∞) — 0 si l'amplitude est nulle/négative (jamais de NaN) ;
 *  NON clampé : l'UI clampe la jauge à 100 et affiche la valeur réelle. */
export function utilizationRate(
  occupiedMinutes: number,
  amplitudeMinutes: number,
): number {
  return amplitudeMinutes > 0 ? occupiedMinutes / amplitudeMinutes : 0;
}

/**
 * Répartition `{name, value}` triée décroissante — `value` = heures (arrondi
 * 0,1, durées brutes : deux activités peuvent légitimement se chevaucher) ou
 * nombre de créneaux selon `metric`. Activité absente → `fallbackLabel` (i18n).
 */
export function activityDistribution(
  reservations: readonly Reservation[],
  metric: "hours" | "slots",
  fallbackLabel: string,
): Array<{ name: string; value: number }> {
  const totals = new Map<string, number>();
  for (const r of reservations) {
    const name = r.activity ?? fallbackLabel;
    let add = 0;
    for (const slot of r.slots) {
      add += metric === "slots" ? 1 : Math.max(0, slot.endMinutes - slot.startMinutes);
    }
    if (add > 0) totals.set(name, (totals.get(name) ?? 0) + add);
  }
  return [...totals.entries()]
    .map(([name, value]) => ({
      name,
      value: metric === "hours" ? Math.round((value / 60) * 10) / 10 : value,
    }))
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name, "fr"));
}

/** Minutes → heures, arrondi 1 décimale, format locale fr (même règle que
 *  `computeKpiValue` dans dashboard.ts). */
export function formatHours(minutes: number): string {
  return (Math.round((minutes / 60) * 10) / 10).toLocaleString("fr-FR");
}
