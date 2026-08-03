/**
 * Rend UNE valeur d'entité en cellule CSV.
 *
 * Le rendu naïf (`Array.join` / `Object.keys`) produit des cellules fausses sur les formes réelles du
 * backend, qui sont rarement des scalaires :
 *   - `otherSociaNetworks: [{type, link}]`  → `"[object Object], [object Object]"`
 *   - `telephone: { mobile: ["0262…"] }`    → `"mobile"` (les CLÉS au lieu du numéro)
 * D'où cette résolution récursive : on cherche la valeur **lisible**, pas la structure.
 */

/** Clés qui portent l'information utile d'un objet-valeur, par ordre de préférence. */
const MEANINGFUL_KEYS = [
  "link", "url", "href",
  "name", "label", "title",
  "value", "text",
  "email", "telephone", "mobile", "phone",
] as const;

const MAX_DEPTH = 4;

/** Un objet dont TOUTES les valeurs valent `true` est un ensemble : l'information est dans ses clés. */
function isFlagSet(obj: Record<string, unknown>): boolean {
  const values = Object.values(obj);
  return values.length > 0 && values.every((v) => v === true);
}

/**
 * Valeur → cellule CSV. Tableaux et objets sont aplatis en `", "` ; les valeurs vides disparaissent
 * (pas de virgules orphelines). Retourne `""` plutôt que `"[object Object]"` quand rien n'est lisible.
 */
export function csvValue(raw: unknown, depth = 0): string {
  if (raw == null) return "";
  if (typeof raw === "string") return raw;
  if (typeof raw === "number" || typeof raw === "boolean") return String(raw);
  if (raw instanceof Date) return Number.isNaN(raw.getTime()) ? "" : raw.toISOString();
  if (depth >= MAX_DEPTH) return "";

  if (Array.isArray(raw)) {
    return raw.map((v) => csvValue(v, depth + 1)).filter((s) => s !== "").join(", ");
  }

  if (typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    if (isFlagSet(obj)) return Object.keys(obj).join(", ");
    // Dès qu'une clé signifiante est PRÉSENTE, elle décide seule — y compris quand elle est vide :
    // une entrée `{type:"Facebook", link:""}` vaut "" (le legacy l'omet), surtout pas son libellé.
    let hasMeaningfulKey = false;
    for (const key of MEANINGFUL_KEYS) {
      if (!(key in obj)) continue;
      hasMeaningfulKey = true;
      const resolved = csvValue(obj[key], depth + 1);
      if (resolved !== "") return resolved;
    }
    if (hasMeaningfulKey) return "";
    // Aucune clé signifiante : on rend les valeurs (pas les clés — c'est la donnée qu'on exporte).
    return Object.values(obj).map((v) => csvValue(v, depth + 1)).filter((s) => s !== "").join(", ");
  }

  return "";
}
