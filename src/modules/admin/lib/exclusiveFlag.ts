import { getPath } from "../sections/resourceHelpers";

/** Sous-ensemble d'une ligne de tableau admin utile à la logique d'exclusivité — même forme
 *  minimale que les lignes rendues par `AdminResourceTable` (item de recherche SDK). */
export interface ExclusiveFlagRow {
  id?: string | null;
  serverData?: Record<string, unknown>;
}

/** Id réel d'une ligne — même repli `id` ⇢ `serverData.id` que `AdminResourceTable` (cf. `rowId`). */
export function exclusiveRowId(row: ExclusiveFlagRow): string | null {
  const raw = row.id ?? (row.serverData as { id?: unknown } | undefined)?.id;
  return raw != null ? String(raw) : null;
}

/**
 * Parmi les lignes CHARGÉES dans le tableau (pas une recherche dédiée sur tout le périmètre —
 * volumétrie admin usuelle, limitation documentée), celles qui portent déjà `field:true` et ne
 * sont pas la cible : à repasser à `false` pour qu'un seul document reste exclusif.
 */
export function itemsToUnset(rows: ExclusiveFlagRow[], field: string, targetId: string | null): ExclusiveFlagRow[] {
  return rows.filter((row) => {
    const id = exclusiveRowId(row);
    if (id != null && targetId != null && id === targetId) return false;
    return getPath(row.serverData, field) === true;
  });
}
