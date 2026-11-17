/**
 * Champs demandés par l'export CSV : ceux de la liste (`baseParams.defaultFields`) plus les champs
 * propres à l'export (`csvButton.fields`). Ces derniers ne partent qu'au clic sur « CSV » : une
 * donnée de contact exportée par un admin n'est pas chargée pour chaque visiteur de la liste.
 *
 * Sans `defaultFields`, la recherche renvoie la projection par défaut : on n'en impose aucune
 * (`undefined`), même si l'export déclare des champs — sinon on RÉDUIRAIT la ligne au lieu de l'étendre.
 */
export function csvExportFields(defaultFields?: readonly string[], extra?: readonly string[]): string[] | undefined {
  if (!defaultFields || defaultFields.length === 0) return undefined;
  return [...new Set([...defaultFields, ...(extra ?? [])])];
}
