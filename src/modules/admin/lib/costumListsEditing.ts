import { normalizeFilterValue } from "@/modules/search/lib/dropdownFilters";

/** Raison de rejet d'une opération d'édition sur `costum.lists` — partagée par toutes les
 *  fonctions de ce module, et par `useCostumListsMutations` pour choisir le toast d'erreur. */
export type ListEditRejection = "empty" | "duplicate" | "invalidChars" | "invalidIndex" | "wouldEmpty";

export type ListEditResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: ListEditRejection };

/**
 * Valeur à AJOUTER à une liste statique (tableau plat). Trim, rejette le vide, dédoublonne
 * casse/accents (`normalizeFilterValue`) contre les valeurs EXISTANTES — même politique que
 * `selectNewValues`/`growCostumLists` (`profil/forms/costum/parent62/fns.ts`) : dédoublonnage
 * seulement, aucune modération de contenu.
 *
 * Ne réutilise PAS `selectNewValues` malgré le chevauchement (même dédoublonnage) : ce dernier
 * traite un LOT de valeurs SOUMISES par un formulaire (silencieux, résultat = celles à garder,
 * sans distinguer la raison d'un rejet) alors qu'ici c'est UNE saisie interactive d'admin, qui
 * doit pouvoir dire PRÉCISÉMENT pourquoi elle est refusée (`ListEditRejection`) pour afficher le
 * bon toast — formes d'entrée/sortie et usage réellement divergents, pas une copie paresseuse.
 */
export function prepareNewValue(candidate: string, existing: readonly string[]): ListEditResult<string> {
  const trimmed = candidate.trim();
  if (trimmed === "") return { ok: false, reason: "empty" };
  const norm = normalizeFilterValue(trimmed);
  if (existing.some((v) => normalizeFilterValue(v) === norm)) return { ok: false, reason: "duplicate" };
  return { ok: true, value: trimmed };
}

/**
 * Renommage de `existing[index]` → `candidate`. Renvoie le TABLEAU COMPLET déjà modifié (prêt
 * pour un `$set` intégral, cf. `useCostumListsMutations`) — pas juste la valeur, pour que
 * l'appelant n'ait qu'à l'écrire telle quelle.
 *
 * Renommer vers une valeur qui ne diffère que par la casse/les accents de SA PROPRE valeur
 * actuelle est autorisé (corriger « pêche » → « Pêche ») ; une collision avec une AUTRE entrée
 * (index différent) est rejetée.
 */
export function prepareRenamedValue(
  candidate: string,
  index: number,
  existing: readonly string[],
): ListEditResult<string[]> {
  if (index < 0 || index >= existing.length) return { ok: false, reason: "invalidIndex" };
  const trimmed = candidate.trim();
  if (trimmed === "") return { ok: false, reason: "empty" };
  const norm = normalizeFilterValue(trimmed);
  const collision = existing.some((v, i) => i !== index && normalizeFilterValue(v) === norm);
  if (collision) return { ok: false, reason: "duplicate" };
  const next = [...existing];
  next[index] = trimmed;
  return { ok: true, value: next };
}

/** Tableau complet SANS l'entrée `index` — no-op défensif (copie inchangée) si hors bornes,
 *  plutôt que de planter sur une liste rafraîchie entre-temps. */
export function removeValueAt(existing: readonly string[], index: number): string[] {
  if (index < 0 || index >= existing.length) return [...existing];
  return existing.filter((_, i) => i !== index);
}

/**
 * Garde défensive avant d'écrire un réordonnancement venu de `SortableList.onReorder` : vérifie
 * que `next` est bien une PERMUTATION de `current` (même multiset) — protège contre un tableau
 * tronqué/dupliqué (bug de `SortableList`, ou liste rafraîchie entre le drag et le drop) qui
 * partirait en écriture à la place d'un simple réordonnancement.
 */
export function isSamePermutation(current: readonly string[], next: readonly string[]): boolean {
  if (current.length !== next.length) return false;
  const a = [...current].sort();
  const b = [...next].sort();
  return a.every((v, i) => v === b[i]);
}

/**
 * Nom d'une NOUVELLE liste (clé de `costum.lists`). Rejette le vide, les caractères `.`/`$`
 * (casseraient le dot-path Mongo `costum.lists.<clé>` en écrivant dans un sous-chemin au lieu de
 * la clé elle-même), et les doublons casse/accents-près contre les clés déjà déclarées.
 */
export function prepareNewListKey(candidate: string, existingKeys: readonly string[]): ListEditResult<string> {
  const trimmed = candidate.trim();
  if (trimmed === "") return { ok: false, reason: "empty" };
  if (trimmed.includes(".") || trimmed.includes("$")) return { ok: false, reason: "invalidChars" };
  const norm = normalizeFilterValue(trimmed);
  if (existingKeys.some((k) => normalizeFilterValue(k) === norm)) return { ok: false, reason: "duplicate" };
  return { ok: true, value: trimmed };
}

/** Une entrée de `props.lists` (`AdminListsSection`) une fois normalisée : soit une clé brute
 *  déclarée telle quelle en config, soit `{key, label}` pour donner un libellé lisible à une clé
 *  technique (`categoriesParole` → « Catégories des paroles »). */
export type ListRef = { key: string; label?: Record<string, string> };

/** `props.lists[i]` peut être une simple clé (string) ou déjà `{key, label}` — uniformise vers la
 *  seconde forme, une fois pour toutes, avant tout lookup. */
export function toListRef(entry: string | ListRef): ListRef {
  return typeof entry === "string" ? { key: entry } : entry;
}

/** Libellé déclaré pour `key` dans la whitelist `props.lists`, s'il y en a un — `undefined` si la
 *  whitelist est absente (mode "toutes les clés") ou si cette clé précise n'a pas de `label`
 *  (l'appelant retombe alors sur la clé brute). Pure : ne fait PAS l'appel `t(...)`, laissé au
 *  composant (ce module ne dépend d'aucun hook i18n). */
export function findListLabel(key: string, whitelist: readonly ListRef[] | undefined): Record<string, string> | undefined {
  return whitelist?.find((ref) => ref.key === key)?.label;
}
