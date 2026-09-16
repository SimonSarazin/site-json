/**
 * Helpers purs du champ `tags` (`tpls.forms.tags`).
 *
 * Isolés de React pour être testables directement, comme `utils/simpleTable.ts`
 * et `utils/categorizedCheckbox.ts`.
 */

/**
 * Extrait les libellés de la réponse de `api.searchTags`.
 *
 * Le endpoint renvoie un tableau HÉTÉROGÈNE (cf. le schéma de `SEARCH_TAGS`) :
 * des documents existants `{_id, tag, field_length}` et, en tête, un élément
 * SYNTHÉTIQUE `{tag}` qui n'est que l'écho du terme cherché — ajouté quand
 * aucun tag existant n'est exactement égal à `q`, et dont le `tag` peut être
 * `null`. On ne garde donc que des chaînes non vides, dédupliquées.
 */
export function parseSearchTagsResponse(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const tag = (item as { tag?: unknown }).tag;
    if (typeof tag !== "string") continue;
    const trimmed = tag.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

/**
 * Filtre un vocabulaire par PRÉFIXE, insensible à la casse, en retirant ce qui
 * est déjà sélectionné.
 *
 * Le préfixe (et non la sous-chaîne) reproduit `SearchTagsAction`, qui filtre
 * en `Api::stringStartsWith(strtolower($v), strtolower($q))`. Une requête vide
 * renvoie tout le vocabulaire — le legacy fait de même (`|| empty($q)`).
 *
 * La déduplication, elle, CORRIGE le legacy : son garde-fou compare
 * `[$key => $v]` à des entrées `["tag" => $v]`, or `$key` vaut `"list"` à cet
 * endroit (la boucle `foreach(explode('.',$key))` l'a écrasé) — la comparaison
 * ne peut donc jamais être vraie et les doublons passent tous. Ici on
 * déduplique réellement.
 *
 * La casse est en revanche significative : le vocabulaire réel contient des
 * paires comme `CO-CRÉATION` / `co-création`, que le legacy garde distinctes.
 */
export function filterLocalTags(
  pool: string[],
  query: string,
  selected: string[],
): string[] {
  const q = query.trim().toLowerCase();
  const taken = new Set(selected);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of pool) {
    const tag = typeof raw === "string" ? raw.trim() : "";
    if (!tag || taken.has(tag) || seen.has(tag)) continue;
    if (q && !tag.toLowerCase().startsWith(q)) continue;
    seen.add(tag);
    out.push(tag);
  }
  return out;
}

/**
 * Découpe une saisie en tags.
 *
 * La virgule sépare, comme le `tokenSeparators: [',']` de select2 côté legacy :
 * coller « a, b, c » pose trois tags d'un coup.
 */
export function splitTagInput(input: string): string[] {
  return input
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

/**
 * Ajoute des tags à une valeur, sans doublon et en préservant l'ordre.
 *
 * Retourne la valeur d'origine (même référence) quand rien n'est ajouté, pour
 * qu'un `onChange` inutile ne redéclenche pas de rendu ni de dirty-state.
 */
export function addTags(value: string[], input: string): string[] {
  const incoming = splitTagInput(input);
  if (incoming.length === 0) return value;
  const existing = new Set(value);
  const added = incoming.filter((t) => !existing.has(t) && (existing.add(t), true));
  return added.length === 0 ? value : [...value, ...added];
}

/** Retire un tag. Retourne la valeur d'origine s'il n'y était pas. */
export function removeTag(value: string[], tag: string): string[] {
  const next = value.filter((t) => t !== tag);
  return next.length === value.length ? value : next;
}

/**
 * Normalise une valeur venue du serveur en `string[]`.
 *
 * Les réponses réelles sont des tableaux de chaînes (`["open source"]`), mais
 * une réponse ancienne peut porter la chaîne brute d'avant le `split(',')`, et
 * PHP sérialise volontiers un tableau vide en `{}`.
 */
export function normalizeTagsValue(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((t) => (typeof t === "string" ? t.trim() : "")).filter(Boolean);
  }
  if (typeof value === "string") return splitTagInput(value);
  return [];
}
