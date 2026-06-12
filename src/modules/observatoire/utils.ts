// Utilitaires partagés du module observatoire.
import type { Equipment, PmrField, PshsField } from "./schema";
import { PMR_FIELDS, PSHS_FIELDS } from "./schema";

/** Coerce une valeur quelconque vers `true` si elle représente l'affirmatif. */
export function isTrue(value: unknown): boolean {
  if (value === true) return true;
  if (typeof value === "number") return value > 0;
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    return v === "true" || v === "1" || v === "oui" || v === "yes";
  }
  return false;
}

/** `aps_name` peut être string CSV ou string[]. Renvoie toujours un tableau. */
export function normalizeAps(value: Equipment["aps_name"]): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  return value
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Renvoie la première chaîne non vide parmi les candidats.
 *  Accepte aussi bien des `string` que des `string[]`. */
export function firstString(
  ...candidates: Array<unknown>
): string | undefined {
  for (const c of candidates) {
    if (typeof c === "string" && c.trim() !== "") return c;
    if (Array.isArray(c)) {
      const first = c.find(
        (v): v is string => typeof v === "string" && v.trim() !== "",
      );
      if (first !== undefined) return first;
    }
  }
  return undefined;
}

/** Extrait une valeur scalaire numérique si possible. */
export function toNumber(value: unknown): number | undefined {
  if (typeof value === "number" && !Number.isNaN(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (!Number.isNaN(n)) return n;
  }
  return undefined;
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

/** Au moins un des 6 champs PMR est vrai. */
export function isPmrAccessible(e: Equipment): boolean {
  return PMR_FIELDS.some((f: PmrField) => isTrue(e[f]));
}

/** Au moins un des 6 champs PSHS est vrai. */
export function isPshsAccessible(e: Equipment): boolean {
  return PSHS_FIELDS.some((f: PshsField) => isTrue(e[f]));
}

/* Accès uniformes aux dimensions principales -------------------- */

export const getCommune = (e: Equipment): string | undefined =>
  firstString(e.address?.addressLocality);

export const getEpci = (e: Equipment): string | undefined =>
  firstString(e.address?.level5Name);

export const getType = (e: Equipment): string | undefined =>
  firstString(e.equip_type_name, e.equip_type_famille, e.type, e.categorie);

export const getNature = (e: Equipment): string | undefined =>
  firstString(e.equip_nature, e.nature);

export const getPropType = (e: Equipment): string | undefined =>
  firstString(e.equip_prop_type);

export const getSurface = (e: Equipment): number | undefined =>
  toNumber(e.equip_surf);

export const getInstName = (e: Equipment): string =>
  firstString(e.inst_nom, e.equip_nom) ?? "—";

export const getEquipId = (e: Equipment, fallback: number): string =>
  e.equip_numero ?? `equip-${fallback}`;
