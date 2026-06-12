// Utilitaires du module observatoire — couche MÉTIER (RES) au-dessus du
// moteur générique de dimensions (./dimensions.ts). Les accesseurs nommés
// sont des wrappers du moteur sur le preset RES : ils restent l'API interne
// lisible des composants, mais une config peut piloter les mêmes mécanismes
// avec d'autres dimensions.
import {
  RES_DIMENSIONS,
  dimensionBool,
  dimensionNumber,
  dimensionValue,
  toStringList,
} from "./dimensions";
import type { Equipment } from "./schema";

// Primitives de coercion — vivent dans le moteur, ré-exportées ici (compat).
export { isTrue, firstString, toNumber, toStringList } from "./dimensions";

/** `aps_name` peut être string CSV ou string[]. Renvoie toujours un tableau. */
export function normalizeAps(value: Equipment["aps_name"]): string[] {
  return toStringList(value);
}

/** Comptage générique par clé. */
export function countBy<T>(
  arr: T[],
  fn: (t: T) => string | undefined,
): Array<{ name: string; value: number }> {
  const m = new Map<string, number>();
  for (const x of arr) {
    const k = fn(x);
    if (!k) continue;
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return Array.from(m.entries()).map(([name, value]) => ({ name, value }));
}

/** Liste triée et dédupliquée des valeurs non vides. */
export function uniqSorted(values: Array<string | undefined>): string[] {
  const set = new Set<string>();
  for (const v of values) {
    if (typeof v === "string" && v.trim() !== "") set.add(v);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, "fr"));
}

// Vocabulaire RES (valeurs du champ `nature`) — vit dans le moteur/preset
// (dimensions.ts), ré-exporté ici (compat composants/tests).
export { NATURE_VALUES } from "./dimensions";
import { NATURE_VALUES } from "./dimensions";

/** Équipement couvert (nature RES « Intérieur »). */
export const isIndoor = (e: Equipment): boolean =>
  getNature(e) === NATURE_VALUES.INDOOR;

/** Au moins un des 6 champs PMR est vrai. */
export const isPmrAccessible = (e: Equipment): boolean =>
  dimensionBool(e, RES_DIMENSIONS.pmr);

/** Au moins un des 6 champs PSHS est vrai. */
export const isPshsAccessible = (e: Equipment): boolean =>
  dimensionBool(e, RES_DIMENSIONS.pshs);

/* Accès uniformes aux dimensions principales (preset RES) -------- */

export const getCommune = (e: Equipment): string | undefined =>
  dimensionValue(e, RES_DIMENSIONS.commune);

export const getEpci = (e: Equipment): string | undefined =>
  dimensionValue(e, RES_DIMENSIONS.epci);

export const getType = (e: Equipment): string | undefined =>
  dimensionValue(e, RES_DIMENSIONS.type);

export const getNature = (e: Equipment): string | undefined =>
  dimensionValue(e, RES_DIMENSIONS.nature);

export const getPropType = (e: Equipment): string | undefined =>
  dimensionValue(e, RES_DIMENSIONS.prop);

export const getSurface = (e: Equipment): number | undefined =>
  dimensionNumber(e, RES_DIMENSIONS.surface);

export const getInstName = (e: Equipment): string =>
  dimensionValue(e, RES_DIMENSIONS.name) ?? "—";

export const getEquipId = (e: Equipment, fallback: number): string =>
  e.equip_numero ?? `equip-${fallback}`;
