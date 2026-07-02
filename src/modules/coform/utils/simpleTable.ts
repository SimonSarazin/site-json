import type { SimpleTableCell, SimpleTableConfig, SimpleTableValue } from "../types";

/**
 * Helpers PURS de mutation d'une valeur simpleTable (tableau 2D : ligne 0 =
 * en-têtes, ligne 1+ = données ; chaque ligne = `[label, ...cellules]`).
 * Aucune mutation en place — utilisés par SimpleTableField (modes inline et modal).
 */

export type SimpleTableRow = (SimpleTableCell | SimpleTableCell[])[];

/** Ligne d'en-têtes dérivée de la config : `[tableName, ...labels de colonnes]`. */
export function buildSimpleTableHeaders(
  config: Pick<SimpleTableConfig, "tableName" | "columns">,
): SimpleTableRow {
  return [config.tableName, ...config.columns.map((c) => c.label)];
}

/** Ligne vierge alignée sur les colonnes (`""`, ou `[]` pour une colonne Images). */
export function buildEmptySimpleTableRow(columns: SimpleTableConfig["columns"]): SimpleTableRow {
  return ["", ...columns.map((c): SimpleTableCell | SimpleTableCell[] => (c.type === "Images" ? [] : ""))];
}

/**
 * Insère (`target: "new"`) ou remplace (`target: index`) une ligne, SANS muter `value`.
 * Si `value` est vide, sème d'abord la ligne d'en-têtes — sinon un tout premier
 * ajout deviendrait la ligne 0 (= en-têtes) et disparaîtrait du corps du tableau.
 */
export function upsertSimpleTableRow(
  value: SimpleTableValue,
  target: number | "new",
  row: SimpleTableRow,
  headers: SimpleTableRow,
): SimpleTableValue {
  const base: SimpleTableValue = value.length === 0 ? [headers] : value.map((r) => [...r]);
  if (target === "new") return [...base, row];
  base[target] = row;
  return base;
}

/** Supprime la ligne à `index` (sans muter `value`). */
export function removeSimpleTableRow(value: SimpleTableValue, index: number): SimpleTableValue {
  return value.filter((_, i) => i !== index);
}
