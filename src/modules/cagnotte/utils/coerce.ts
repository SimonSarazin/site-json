/**
 * Coercions de base du module cagnotte, extraites de `dataTransform` pour casser un cycle :
 * `financerPayment` a besoin de ces primitives, et `dataTransform` de `financerPayment`.
 * `dataTransform` les ré-exporte, aucun import existant n'a bougé.
 *
 * Ce fichier n'importe JAMAIS rien du module : ce qui a besoin d'un type métier va dans
 * `dataTransform`.
 */

export type UnknownRecord = Record<string, unknown>;

/**
 * Coerce une valeur en `Record<string, unknown>`. Retourne `{}` pour `null`, `undefined`,
 * les primitives ou les valeurs non-objet. À utiliser comme garde-fou avant un accès dynamique.
 */
export function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === "object" ? (value as UnknownRecord) : {};
}

/**
 * Coerce en tableau : tableaux pass-through, objets → `Object.values`, sinon `[]`.
 * Utile pour les structures backend qui sont parfois sérialisées en `{ "0": ..., "1": ... }`.
 *
 * Les clés sont PERDUES : quand elles comptent — viser une dépense côté serveur — passer par
 * `depenseKey.ts`, qui les conserve en parallèle.
 */
export function toArrayOrValues<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === "object") return Object.values(value as Record<string, T>);
  return [];
}

/**
 * Coerce en `number` finite. Retourne `0` pour `null`, `undefined`, `NaN`, `Infinity`.
 */
export function toNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Coerce en `string`. Retourne `''` pour toute valeur non-string (y compris numbers,
 * pour éviter les `"[object Object]"`).
 */
export function toString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** Identifiant en chaîne : chaîne telle quelle, nombre converti, sinon `''`. */
export function toId(value: unknown): string {
  return typeof value === "number" ? String(value) : toString(value);
}
