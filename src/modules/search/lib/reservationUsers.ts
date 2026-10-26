import type { Reservation } from "./reservations";

/**
 * Logique PURE du périmètre « organisations usagères » (`searchProStatic.reservationUsers`) et des
 * équipements réservés restreints au site (`preview.bookedResources.poiFilters`).
 *
 * Contrat d'un périmètre d'identifiants — même convention que `parentIdsFilter`
 * (`resourceDirectoryFilters.ts`) : `null` = pas de périmètre ; tableau VIDE = aucun élément
 * possible, que l'appelant N'ENVOIE PAS : `SearchNew::searchFilters` ignore un `$in` vide
 * (`!empty($value['$in'])` est faux) et la liste rendrait alors TOUTES les organisations.
 */

/** Équipements pointés par au moins une réservation — triés et sans doublon (clé de cache stable). */
export function reservedResourceIds(reservations: readonly Pick<Reservation, "resourceIds">[]): string[] {
  return [...new Set(reservations.flatMap((r) => r.resourceIds))].sort();
}

/**
 * Organisations usagères (finder `userOrga`) d'au moins une réservation qui touche un équipement du
 * périmètre — triées, sans doublon. Une réservation sans identifiant d'organisation (texte historique
 * seul) ne désigne aucune fiche : elle ne compte pas, comme dans `useOrgaReservationsQuery`.
 */
export function reservationUserIds(
  reservations: readonly Pick<Reservation, "resourceIds" | "userId">[],
  inPerimeter: ReadonlySet<string>,
): string[] {
  const ids = new Set<string>();
  for (const r of reservations) {
    if (r.userId && r.resourceIds.some((id) => inPerimeter.has(id))) ids.add(r.userId);
  }
  return [...ids].sort();
}

/**
 * Périmètre avec `includeCostumOrganizations` : les usagères ET les organisations rattachées au costum
 * du site (ex. une association ajoutée depuis l'annuaire, avant son premier créneau) — triées, sans
 * doublon (clé de cache stable) : une organisation à la fois usagère et rattachée ne compte qu'une fois.
 */
export function withCostumOrganizations(userIds: readonly string[], costumIds: readonly string[]): string[] {
  return [...new Set([...userIds, ...costumIds])].sort();
}

/**
 * Filtres de la liste restreints au périmètre calculé. Un `_id.$in` déjà posé (facette « par
 * réponses », qui part en `_id`) est INTERSECTÉ, pas écrasé : `mergeMongoFilters` ferait gagner l'un
 * des deux `$in` en silence. `none` = aucun élément possible → ni requête, ni `$in` vide envoyé.
 * Sans périmètre, `filters` ressort par la MÊME référence : aucune queryKey existante ne bouge.
 */
export function scopeFiltersToIds<T extends Record<string, unknown>>(
  filters: T,
  ids: readonly string[] | null,
): { filters: T; none: boolean } {
  if (ids === null) return { filters, none: false };
  const current = filters._id as Record<string, unknown> | undefined;
  const existing = current?.$in;
  const scoped = Array.isArray(existing) ? ids.filter((id) => existing.includes(id)) : [...ids];
  if (scoped.length === 0) return { filters, none: true };
  return { filters: { ...filters, _id: { ...current, $in: scoped } }, none: false };
}

/** Équipements réservés gardés s'ils sont dans le périmètre ; `null` = pas de périmètre, tout reste. */
export function keepInPerimeter<T extends { resourceId: string }>(
  groups: readonly T[],
  allowed: readonly string[] | null,
): T[] {
  if (allowed === null) return [...groups];
  const set = new Set(allowed);
  return groups.filter((g) => set.has(g.resourceId));
}
