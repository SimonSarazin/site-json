/**
 * Mots-clés DÉRIVÉS d'un champ de saisie — un ou plusieurs types (`category`…) qui posent chacun un tag public,
 * parce que ce sont les `tags` qu'interrogent pages et sections. Fonctions PURES, branchées en codecs
 * `read`/`write` du champ `tags` par le module du costum (qui fournit sa table valeur → tag).
 *
 * Pourquoi pas un `mutation.stamps` `op:"append"` : il refusionne les tags SERVEUR à chaque enregistrement,
 * donc le tag d'un ancien type revenait dès que le nouveau type en posait un — impossible, par exemple, de
 * sortir une actualité du bandeau « À la une » en changeant son type. Ici les tags SUIVENT les types :
 *
 *   read  (édition)  tags affichés = tags serveur − tags des types ENREGISTRÉS
 *   write (save)     tags envoyés  = tags affichés ∪ tags des types CHOISIS
 *
 * On ne soustrait que les tags des types réellement enregistrés, jamais toute la table : un tag posé à la main
 * sur une fiche d'un autre type (ex. « A la une » sur un « Article simple », avant que ce type existe) reste
 * visible dans le champ, donc modifiable, au lieu d'être masqué puis perdu au save.
 *
 * Les types arrivent sous la forme stockée (texte « a, b » : le contrat serveur type le champ en chaîne) ou
 * sous celle du formulaire (tableau) : `coerceStringArray` lit les deux.
 */
import { coerceStringArray } from "@/modules/formEngine/engine/coercions";

/** Tags dérivés des types (dans l'ordre des types, sans doublon). */
function tagsDerives(types: unknown, table: Readonly<Record<string, string>>): string[] {
  const tags = coerceStringArray(types).map((t) => table[t]).filter((t): t is string => typeof t === "string");
  return [...new Set(tags)];
}

/** READ : tags serveur sans les tags dérivés des types enregistrés. */
export function tagsSansDerive(tagsServeur: unknown, typesEnregistres: unknown, table: Readonly<Record<string, string>>): string[] {
  const derives = new Set(tagsDerives(typesEnregistres, table));
  return coerceStringArray(tagsServeur).filter((t) => !derives.has(t));
}

/** WRITE : tags saisis + tags dérivés des types choisis (sans doublon, ajoutés en dernier). */
export function tagsAvecDerive(tagsSaisis: unknown, typesChoisis: unknown, table: Readonly<Record<string, string>>): string[] {
  const tags = coerceStringArray(tagsSaisis);
  return [...tags, ...tagsDerives(typesChoisis, table).filter((t) => !tags.includes(t))];
}
