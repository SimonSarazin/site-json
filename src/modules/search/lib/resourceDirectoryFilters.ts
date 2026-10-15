import type { SearchByFieldValue } from "../contexts/pageFilters";
import type { ServicePricingStat } from "../helpers/servicePricingAnswers";

/**
 * Filtres de l'annuaire des ressources appliqués CÔTÉ NAVIGATEUR — capacité d'accueil et région du
 * lieu porteur — et croisement « réseau thématique × lieu cliqué » envoyé au backend (`parentId`).
 * Ni la capacité (dans le tableau des salles) ni la région (sur le lieu porteur, pas sur la réponse) ne
 * sont filtrables par `Navigator::getRessourceTL` ; l'annuaire charge toutes ses ressources d'un coup
 * (`indexStep` borné), le filtre navigateur voit donc l'ensemble.
 */

/** Tranches de capacité (personnes ou postes) : `"min-max"`, côté vide = sans plafond. */
export const CAPACITY_FILTER_RANGES = [
  { id: "1-10", label: { fr: "1 à 10", en: "1 to 10" } },
  { id: "10-30", label: { fr: "10 à 30", en: "10 to 30" } },
  { id: "30-50", label: { fr: "30 à 50", en: "30 to 50" } },
  { id: "50-", label: { fr: "plus de 50", en: "over 50" } },
] as const;

/** `"10-30"` → `{ min: 10, max: 30 }` ; `"50-"` → `{ min: 50, max: Infinity }` ; mal formée → `null`. */
export function parseCapacityRange(id: string): { min: number; max: number } | null {
  const m = /^(\d*)-(\d*)$/.exec(id);
  if (!m || (!m[1] && !m[2])) return null;
  return { min: m[1] ? Number(m[1]) : 0, max: m[2] ? Number(m[2]) : Infinity };
}

/**
 * Capacité d'une ressource, lue sur la même statistique que sa pastille : salle de réunion = de N à M
 * personnes, coworking = nombre de postes, hébergement = nombre de chambres (pas de nombre de personnes
 * saisi). `null` si inconnue.
 */
export function resourceCapacity(stat: ServicePricingStat | undefined): { min: number; max: number } | null {
  if (!stat) return null;
  if (stat.kind === "meeting") {
    // Même règle que la pastille (`formatCapacityRange`) : un seul des deux bornes saisi suffit ; il
    // sert alors des deux côtés (« 10 » affiché = capacité 10).
    const r = stat.range;
    if (!r || (r.min <= 0 && r.max <= 0)) return null;
    return { min: r.min || r.max, max: r.max || r.min };
  }
  return stat.count > 0 ? { min: stat.count, max: stat.count } : null;
}

/**
 * La capacité recoupe-t-elle UNE des tranches cochées ? Aucune tranche cochée → vrai ; capacité
 * inconnue avec une tranche cochée → faux (on ne sait pas l'affirmer). Bornes `[min, max]` incluses :
 * une salle de 10 personnes est dans « 1 à 10 » et dans « 10 à 30 ».
 */
export function matchesCapacity(capacity: { min: number; max: number } | null, rangeIds: readonly string[]): boolean {
  if (rangeIds.length === 0) return true;
  if (!capacity) return false;
  return rangeIds.some((id) => {
    const r = parseCapacityRange(id);
    return !!r && capacity.max >= r.min && capacity.min <= r.max;
  });
}

/** Zones cochées dans un groupe `scopeList` (`{ id, type: "level3" }`) — lues dans `searchByFields`. */
export function selectedZones(
  searchByFields: Record<string, SearchByFieldValue> | undefined,
): Array<{ id: string; level: string }> {
  const zones: Array<{ id: string; level: string }> = [];
  for (const { type, value } of Object.values(searchByFields ?? {})) {
    if (type !== "scopeList" || !value || typeof value !== "object" || Array.isArray(value)) continue;
    const { id, type: level } = value as { id?: unknown; type?: unknown };
    if (typeof id === "string" && typeof level === "string") zones.push({ id, level });
  }
  return zones;
}

/** Le lieu porteur est-il dans UNE des zones cochées ? Aucune zone → vrai ; lieu inconnu → faux. */
export function matchesZones(
  zonesOfParent: Partial<Record<string, string>> | undefined,
  zones: ReadonlyArray<{ id: string; level: string }>,
): boolean {
  if (zones.length === 0) return true;
  if (!zonesOfParent) return false;
  return zones.some((z) => zonesOfParent[z.level] === z.id);
}

/**
 * Lieux membres des réseaux thématiques cochés, lus dans `searchByFields` (entrées `_id` du groupe
 * `filtersByPath`) — et non dans `searchByFieldsToQuery`, qui saute les tableaux vides : un réseau
 * coché SANS lieu membre y disparaîtrait et le filtre avec. `null` = aucun réseau coché ; `[]` = des
 * réseaux cochés, mais aucun lieu membre.
 */
export function thematicParentIds(searchByFields: Record<string, SearchByFieldValue> | undefined): string[] | null {
  let ids: string[] | null = null;
  for (const { field, type, value } of Object.values(searchByFields ?? {})) {
    if (field !== "_id" || type || !Array.isArray(value)) continue;
    ids = [...new Set([...(ids ?? []), ...value])];
  }
  return ids;
}

/**
 * Lieux porteurs à envoyer au backend (`filters.parentId.$in`) : membres des réseaux thématiques
 * cochés, croisés avec le lieu cliqué sur une carte. `null` = aucun filtre de lieu. Un tableau VIDE
 * veut dire « aucune ressource possible » (lieu cliqué hors des réseaux cochés, réseau sans membre) :
 * l'appelant NE DOIT PAS l'envoyer — `Navigator::getRessourceTL` teste `$parentToFind != null`, et en
 * PHP `[] != null` est faux : un `$in` vide est ignoré et tout l'annuaire revient.
 */
export function parentIdsFilter(thematicIds: readonly string[] | null, activeParentId: string | null): string[] | null {
  if (thematicIds === null) return activeParentId ? [activeParentId] : null;
  if (!activeParentId) return [...thematicIds];
  return thematicIds.includes(activeParentId) ? [activeParentId] : [];
}

/**
 * Groupes de filtres ouverts à l'arrivée : les `count` premiers groupes RÉELLEMENT déclarés, dans
 * l'ordre d'affichage (type, thématique, capacité, zone, prix) — jamais un groupe absent, et la
 * seule facette configurée n'arrive pas repliée.
 */
export function defaultOpenFilterGroups(
  declared: { thematic: boolean; capacity: boolean; region: boolean; priceGroupIds: readonly string[] },
  count = 2,
): string[] {
  return [
    "resourceType",
    ...(declared.thematic ? ["thematic"] : []),
    ...(declared.capacity ? ["capacity"] : []),
    ...(declared.region ? ["region"] : []),
    ...declared.priceGroupIds,
  ].slice(0, count);
}
