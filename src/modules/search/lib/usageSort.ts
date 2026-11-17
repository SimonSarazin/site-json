/**
 * Logique PURE du tri de la liste par taux d'occupation (`searchProStatic.usageSort`). Le taux n'existe pas en
 * base : il se calcule sur les réservations (`plannedRates`, `observatoire/usage.ts`), d'où un tri côté
 * navigateur, sur tout le périmètre chargé.
 */

export type UsageSortOrder = "desc" | "asc";

export const USAGE_SORT_ORDERS: readonly UsageSortOrder[] = ["desc", "asc"];

/** Param d'URL du tri quand la config n'en nomme pas (`usageSort.id`). */
export const DEFAULT_USAGE_SORT_PARAM = "tri";

/** Ordre lu dans l'URL ; valeur inconnue (lien abîmé) → `null`, le tri du serveur (par nom). */
export function sortOrderFromParam(raw: string | null): UsageSortOrder | null {
  return USAGE_SORT_ORDERS.find((o) => o === raw) ?? null;
}

/**
 * Items classés par taux : ceux qui en ont un d'abord (décroissant ou croissant), puis les autres. Tri STABLE :
 * à taux égal, et pour tous les items sans taux, l'ordre reçu — celui du serveur, par nom — est gardé. Un item
 * sans identifiant n'a pas de taux.
 */
export function sortByUsageRate<T>(
  items: readonly T[],
  idOf: (item: T) => string | undefined,
  rates: ReadonlyMap<string, number>,
  order: UsageSortOrder,
): T[] {
  const sign = order === "desc" ? -1 : 1;
  const rated: Array<{ item: T; rate: number; index: number }> = [];
  const unrated: T[] = [];
  items.forEach((item, index) => {
    const id = idOf(item);
    const rate = id === undefined ? undefined : rates.get(id);
    if (rate === undefined) unrated.push(item);
    else rated.push({ item, rate, index });
  });
  rated.sort((a, b) => (a.rate === b.rate ? a.index - b.index : sign * (a.rate - b.rate)));
  return [...rated.map((r) => r.item), ...unrated];
}
