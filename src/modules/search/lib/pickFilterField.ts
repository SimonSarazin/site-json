/**
 * Matrice de sélection du widget compact d'un groupe de filtres (config
 * `select` — cf. FilterSelectConfigSchema), alignée sur celle de l'observatoire :
 *
 * | config                          | widget       |
 * |---------------------------------|--------------|
 * | `undefined`                     | `null` (accordéon : pas de widget compact) |
 * | `{}`                            | `"select"` (Select simple) |
 * | `{ multiple }`                  | `"multi-checkbox"` (combobox multi coche-à-droite) |
 * | `{ searchable }`                | `"multi-single"` (recherche, sélection unique) |
 * | `{ multiple, searchable }`      | `"multi"` (recherche + badges multi) |
 */
export type FilterFieldKind = "select" | "multi-checkbox" | "multi" | "multi-single";

export function pickFilterField(
  conf: { multiple?: boolean; searchable?: boolean } | undefined,
): FilterFieldKind | null {
  if (!conf) return null;
  if (conf.searchable) return conf.multiple ? "multi" : "multi-single";
  return conf.multiple ? "multi-checkbox" : "select";
}
