/**
 * Tendance mensuelle d'un KPI `searchCount` — dérivée des dates `created` du périmètre CHARGÉ.
 *
 * Limite assumée (documentée dans le schéma) : les suppressions ne sont pas historisées côté
 * backend, on ne peut donc pas reconstituer le « total du mois dernier ». On compare les
 * CRÉATIONS du mois courant aux créations du mois précédent — fidèle tant que les suppressions
 * restent marginales, et toujours vrai pour « +N ce mois-ci ».
 */

export interface MonthlyTrend {
  /** Items créés depuis le 1er du mois courant. */
  addedThisMonth: number;
  /** Items créés durant le mois calendaire précédent. */
  addedLastMonth: number;
  /** addedThisMonth − addedLastMonth (signe = direction de la tuile). */
  delta: number;
}

/**
 * Normalise les sérialisations de date rencontrées sur `serverData.created` (mêmes shapes que
 * `formatCell` de resourceHelpers) : `Date` revivifiée par la lib, epoch int (secondes legacy ou
 * millisecondes), `{sec}` (MongoDate PHP), `{$date}` (number | string ISO | {$numberLong}).
 * Seuil sec/ms : 1e12 (≈ 2001 en ms, ≈ 33658 en s) — aucune donnée réelle n'est ambiguë.
 */
export function toCreatedDate(value: unknown): Date | null {
  if (value == null) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "number") return new Date(value > 1e12 ? value : value * 1000);
  if (typeof value === "string") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === "object") {
    const { sec, $date } = value as { sec?: unknown; $date?: unknown };
    if (typeof sec === "number") return new Date(sec * 1000);
    if (typeof $date === "number" || typeof $date === "string") return toCreatedDate($date);
    const long = ($date as { $numberLong?: unknown } | undefined)?.$numberLong;
    if (typeof long === "string") return new Date(Number(long));
  }
  return null;
}

export function computeMonthlyTrend(createdValues: readonly unknown[], now: Date): MonthlyTrend {
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  let addedThisMonth = 0;
  let addedLastMonth = 0;
  for (const raw of createdValues) {
    const d = toCreatedDate(raw);
    if (!d) continue;
    if (d >= startOfMonth) addedThisMonth += 1;
    else if (d >= startOfPrevMonth) addedLastMonth += 1;
  }
  return { addedThisMonth, addedLastMonth, delta: addedThisMonth - addedLastMonth };
}
