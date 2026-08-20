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
 * Parmi un jeu de fiches, celles qui portent déjà `field:true` et ne sont pas la cible : à
 * repasser à `false` pour qu'un seul document reste exclusif. Depuis la review MR 44, le jeu
 * vient d'une RECHERCHE SERVEUR dédiée (`fetchFlagged`) — plus jamais des seules lignes
 * chargées : l'ex-« une » peut être ancienne et vivre hors de la fenêtre de l'infinite scroll.
 */
export function itemsToUnset(rows: ExclusiveFlagRow[], field: string, targetId: string | null): ExclusiveFlagRow[] {
  return rows.filter((row) => {
    const id = exclusiveRowId(row);
    if (id != null && targetId != null && id === targetId) return false;
    return getPath(row.serverData, field) === true;
  });
}

/** Fiche écrivable (updateField) — le contrat minimal de l'orchestration d'exclusivité. */
export interface ExclusiveWritable extends ExclusiveFlagRow {
  updateField: (path: string, value: unknown) => Promise<unknown>;
}

/**
 * Orchestration de la bascule exclusive (pure, testée — le hook ne fait que l'envelopper) :
 *  1. la CIBLE d'abord — l'intention de l'admin est posée même si la suite échoue. Sous
 *     l'affichage option B (une seule liste + épinglée cherchée serveur), un double-flag
 *     transitoire est BÉNIN (la plus récente gagne, rien ne disparaît) ; l'ancien ordre
 *     unset-avant-set laissait ZÉRO flag en cas d'échec du set (une retombée silencieuse).
 *  2. le périmètre vient de `fetchFlagged` (recherche serveur `{field:true}`) — jamais des
 *     lignes chargées (finding high review MR 44) ; chaque unset est BEST-EFFORT : un échec
 *     (ex. 401 sur une fiche hors allowance) est compté, pas propagé — la cible reste posée.
 */
export async function runExclusiveFlag({ field, value, target, fetchFlagged }: {
  field: string;
  value: boolean;
  target: ExclusiveWritable;
  fetchFlagged: () => Promise<ExclusiveWritable[]>;
}): Promise<{ unsetFailures: number }> {
  await target.updateField(field, value);
  if (!value) return { unsetFailures: 0 };
  let unsetFailures = 0;
  const flagged = await fetchFlagged();
  for (const other of itemsToUnset(flagged, field, exclusiveRowId(target))) {
    try {
      await (other as ExclusiveWritable).updateField(field, false);
    } catch {
      unsetFailures += 1;
    }
  }
  return { unsetFailures };
}
