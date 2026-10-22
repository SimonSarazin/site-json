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

/** L'identifiant de palier d'une dépense (`milestone`), ou `""` pour une dépense orpheline. */
function milestoneOf(depense: unknown): string {
  const id = depense && typeof depense === "object" ? (depense as Record<string, unknown>).milestone : null;
  return typeof id === "string" ? id : "";
}

/** Les dépenses d'un bloc, dans l'ordre de `listDepenseKeys`. */
function listDepenseValues(depenses: unknown): unknown[] {
  if (Array.isArray(depenses)) return depenses;
  if (depenses && typeof depenses === "object") return Object.values(depenses as Record<string, unknown>);
  return [];
}

/**
 * Une clé que JavaScript énumère à son rang d'entier : « 0 », « 7 », « 12 » — pas « 01 », pas
 * « a ». Un objet qui n'a que de telles clés s'énumère dans l'ordre numérique, celui dans lequel le
 * formulaire range ses lignes.
 */
const ORDERED_KEY = /^(0|[1-9]\d*)$/;

/**
 * La clé, dans le document ENREGISTRÉ, de la dépense qu'un formulaire tient à la position `index`
 * de sa liste LOCALE — ou `null` si l'on ne peut pas l'affirmer.
 *
 * Un formulaire édite sa liste avant de l'enregistrer : une ligne ajoutée n'existe pas encore au
 * document, une ligne retirée décale toutes les suivantes. La position locale ne dit donc rien de
 * la clé enregistrée — or c'est par elle qu'on désigne une dépense au serveur (son fil de
 * discussion, par exemple). Se tromper, c'est ouvrir le fil d'une AUTRE dépense.
 *
 *   - une dépense qui porte son identifiant de palier (`milestone`) se retrouve par lui, où qu'elle
 *     soit dans les deux listes — à condition qu'il ne désigne qu'UNE dépense enregistrée ;
 *   - une dépense orpheline (sans identifiant) ne se retrouve que par sa position, et la position
 *     ne vaut que si la liste n'a pas changé de forme depuis l'enregistrement : même longueur, mêmes
 *     identifiants aux mêmes places. La modifier sur place ne change pas sa forme. Encore faut-il
 *     que le document range ses dépenses dans l'ordre où un formulaire les liste — un tableau, ou
 *     des clés entières écrites sans zéro de tête (`ORDERED_KEY`) : sous une clé comme « 01 », les
 *     deux ordres divergent, et la position ne dit plus rien.
 */
export function resolveSavedDepenseKey(depenses: unknown, lines: readonly unknown[], index: number): string | null {
  if (!Number.isInteger(index) || index < 0 || index >= lines.length) return null;
  const keys = listDepenseKeys(depenses);
  const saved = listDepenseValues(depenses).map(milestoneOf);
  const id = milestoneOf(lines[index]);
  if (id !== "") {
    const position = saved.indexOf(id);
    return position !== -1 && saved.indexOf(id, position + 1) === -1 ? keys[position] : null;
  }
  if (lines.length !== saved.length || lines.some((line, position) => milestoneOf(line) !== saved[position])) return null;
  return keys.every(key => ORDERED_KEY.test(key)) ? keys[index] : null;
}
