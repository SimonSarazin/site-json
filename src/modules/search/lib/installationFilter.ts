import type { SearchByFieldValue } from "../contexts/pageFilters";
import { keyFor, splitKey } from "./dropdownFilters";

/**
 * Logique PURE du filtre « installation » déclenché depuis une carte
 * (`CardPoiAmenities`). Aucun dropdown : la valeur cliquée EST la sélection.
 *
 * Contrat d'état : réutilise les clés composites `${param}:${valeur}` de
 * `dropdownFilters` (`keyFor`) dans `searchByFields` → le préfixe isole ce
 * filtre des autres (leur nettoyage se fait par préfixe) et
 * `searchByFieldsToQuery` fusionne nativement les entrées de même `field` en un
 * seul `$in` : le cumul est gratuit.
 *
 * Contrat d'URL : `?<param>=<v1>,<v2>` — format maison partagé avec les
 * sidebars, d'où la règle « pas de virgule dans une valeur » (raison pour
 * laquelle on filtre sur l'identifiant stable, jamais sur le libellé).
 */

/** Valeurs actives du filtre, dans l'ordre d'insertion de l'état. */
export function activeValues(
  searchByFields: Record<string, SearchByFieldValue>,
  param: string,
): string[] {
  const out: string[] = [];
  for (const key of Object.keys(searchByFields)) {
    const parsed = splitKey(key);
    if (parsed?.filterId === param && parsed.optionId) out.push(parsed.optionId);
  }
  return out;
}

/** Toggle : présent → retiré, absent → ajouté (cumul, comme les autres filtres). */
export function nextValues(active: readonly string[], value: string): string[] {
  return active.includes(value) ? active.filter((v) => v !== value) : [...active, value];
}

/** Miroir URL. Sélection vide → suppression du param (pas de `?param=`). */
export function toParam(params: URLSearchParams, param: string, values: readonly string[]): void {
  if (values.length) params.set(param, values.join(","));
  else params.delete(param);
}

/** Lecture URL → valeurs (tolérante : vides et doublons éliminés). */
export function fromParam(raw: string | null): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  for (const v of raw.split(",")) {
    const trimmed = v.trim();
    if (trimmed) seen.add(trimmed);
  }
  return [...seen];
}

/** Projection `valeurs → searchByFields` (clés préfixées `param:`). */
export function toSearchByFields(
  param: string,
  field: string,
  values: readonly string[],
): Record<string, SearchByFieldValue> {
  const out: Record<string, SearchByFieldValue> = {};
  for (const value of values) {
    out[keyFor(param, value)] = { field, value: [value] };
  }
  return out;
}
