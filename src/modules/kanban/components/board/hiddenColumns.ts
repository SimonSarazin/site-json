/**
 * Colonnes masquees LOCALEMENT, par tableau — logique PURE (DESIGN §6.3, §6.6).
 *
 * Un board-lien affiche les six statuts de Kanban gestion (blueprint D13) ;
 * chacun masque ceux qu'il n'utilise pas, comme dans gestion. Depuis le §12.8
 * (D34), la vue Roles masque de meme ses colonnes de role — le repli des
 * colonnes du kanban des roles de Communecter (spec §1.2). C'est une
 * preference de POSTE, pas une donnee partagee : elle vit dans le
 * `localStorage` (une cle par tableau ET par portee) et n'est lue qu'apres
 * l'hydratation.
 *
 * Tout ce qui se calcule ici est teste (`components/board/hiddenColumns.test.ts`) :
 * une valeur de stockage abimee ne doit jamais masquer tout un tableau.
 */

/**
 * Prefixe des cles de stockage. Distinct de celui de co-kanban (`cokanban.`) : un site et
 * l'application peuvent partager une origine en developpement sans melanger leurs preferences.
 */
const STORAGE_PREFIX = 'kanban.hiddenColumns.';

/**
 * PORTEES du masquage : les colonnes du Tableau (`kanban`), les colonnes de
 * role de la vue Roles (`roles`). Chacune a sa cle et son fournisseur : masquer
 * « Trésorerie » dans les roles ne touche pas « À tester » dans le Tableau.
 */
export type HiddenColumnsScope = 'kanban' | 'roles';

export const HIDDEN_COLUMNS_SCOPES: readonly HiddenColumnsScope[] = ['kanban', 'roles'];

/**
 * Cle de stockage des colonnes masquees d'un tableau, pour une portee.
 *
 * Le Tableau a la cle sans suffixe (celle de co-kanban, dont ce fichier est la copie) ;
 * les autres portees ajoutent `:<portee>` (`kanban.hiddenColumns.<id>:roles`, D34).
 */
export function hiddenColumnsStorageKey(boardId: string, scope: HiddenColumnsScope = 'kanban'): string {
  return scope === 'kanban' ? `${STORAGE_PREFIX}${boardId}` : `${STORAGE_PREFIX}${boardId}:${scope}`;
}

/**
 * Lit la valeur stockee. Tout ce qui n'est pas un tableau JSON de chaines
 * (valeur d'une ancienne version, saisie a la main, stockage corrompu) donne
 * « rien de masque » : mieux vaut tout montrer que cacher au hasard.
 */
export function parseHiddenColumns(raw: string | null | undefined): string[] {
  if (typeof raw !== 'string' || raw === '') return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const ids = parsed.filter((value): value is string => typeof value === 'string' && value !== '');
  return [...new Set(ids)];
}

/** Forme stockee : tableau JSON trie (deux postes produisent la meme chaine). */
export function serializeHiddenColumns(ids: readonly string[]): string {
  return JSON.stringify([...new Set(ids)].sort());
}

/** Masque la colonne si elle est visible, la reaffiche sinon. */
export function toggleHiddenColumn(hidden: readonly string[], columnId: string): string[] {
  return hidden.includes(columnId)
    ? hidden.filter((id) => id !== columnId)
    : [...hidden, columnId];
}

/**
 * Ne garde que les colonnes qui EXISTENT encore.
 *
 * Le stockage est une preference de poste : il garde l'id d'une colonne qu'un
 * autre membre (ou un autre appareil) a supprimee depuis. Les ecrans qui
 * comptent les colonnes masquees passent donc par ici — « Colonnes affichées »
 * activait sinon « Tout afficher » alors que toutes ses cases etaient cochees.
 * (Le tableau, lui, n'affiche que les colonnes de l'instantane : un id perime
 * n'y masque rien.)
 */
export function pruneHiddenColumns(hidden: readonly string[], existingIds: readonly string[]): string[] {
  const existing = new Set(existingIds);
  return hidden.filter((id) => existing.has(id));
}

/** Colonnes a afficher, dans l'ordre recu. */
export function visibleColumnIds(columnIds: readonly string[], hidden: readonly string[]): string[] {
  if (hidden.length === 0) return [...columnIds];
  const masked = new Set(hidden);
  return columnIds.filter((id) => !masked.has(id));
}
