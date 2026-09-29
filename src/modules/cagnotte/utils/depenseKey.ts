/**
 * La CLÉ d'une dépense dans le document, distincte de sa POSITION dans la liste densifiée.
 *
 * `answers.<step>.depense` arrive parfois en objet à clés creuses (`{ "0": …, "3": … }`) :
 * `toArrayOrValues` le densifie et jette les clés, si bien que la dépense `"3"` se retrouve en
 * position `1`. Les endpoints indexent par la clé (`isset($depenses[$depenseKey])`) et
 * répondent `"depense not found"`.
 *
 * Réservé aux dépenses ORPHELINES : dès qu'un `milestone` existe, envoyer `milestoneId`, que
 * `Aap::findDepenseKeyForMilestone` résout côté serveur. Cf. doc/34 §9.
 */

/**
 * Les clés d'un bloc `depense`, dans l'ordre où `toArrayOrValues` rend ses valeurs :
 * `Object.keys()` et `Object.values()` itèrent dans le même ordre sur le même objet.
 */
export function listDepenseKeys(depenses: unknown): string[] {
  if (Array.isArray(depenses)) return depenses.map((_, index) => String(index));
  if (depenses && typeof depenses === "object") return Object.keys(depenses as Record<string, unknown>);
  return [];
}

/**
 * La clé de la dépense occupant `depenseIndex` : `({ "0": …, "3": … }, 1)` rend `"3"`.
 * `null` si la position n'existe pas — renoncer alors, plutôt qu'inventer une clé.
 */
export function resolveDepenseKey(depenses: unknown, depenseIndex: number): string | null {
  if (!Number.isInteger(depenseIndex) || depenseIndex < 0) return null;
  const keys = listDepenseKeys(depenses);
  return depenseIndex < keys.length ? keys[depenseIndex] : null;
}
