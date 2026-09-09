/**
 * Quels FILTRES l'annuaire affiche, à partir du bloc `filters` de la section —
 * fonction PURE.
 *
 * ⚠️ La config JSON n'est JAMAIS parsée par Zod à l'exécution : les `.default()`
 * de `AacDirectorySectionSchema` sont documentaires. Un site qui écrit
 * `"filters": { "search": false }` livre donc au composant un objet à UNE clé,
 * et un défaut JS de destructuration (`filters = {…}`) ne joue que si le bloc
 * est ABSENT — les quatre autres filtres seraient éteints par omission.
 *
 * Le contrat est celui du schéma, clé par clé : un bloc partiel veut dire
 * « je change ceux-là, le reste par défaut ». D'où la fusion ici, et nulle part
 * ailleurs — la section n'a pas à connaître la liste des filtres.
 *
 * Un `undefined` explicite vaut « non renseigné » (comme pour Zod), pas `false`.
 */

/** Les filtres de l'annuaire, tous résolus. */
export interface AacDirectoryEnabledFilters {
  search: boolean;
  /** « Filtrer par besoins » — usage catégorisé, deux niveaux. */
  usage: boolean;
  tags: boolean;
  /** La question « Utilisable » du formulaire. */
  maturity: boolean;
  /** « Trier par ». */
  sort: boolean;
}

/** Le bloc tel qu'il arrive de la config : chaque clé peut manquer. */
export type AacDirectoryFiltersConfig = Partial<AacDirectoryEnabledFilters>;

/**
 * Tout activé — le défaut du schéma. Un filtre activé mais dont la question
 * n'a pas pu être résolue est masqué par le panneau, jamais rendu inerte.
 */
export const DEFAULT_AAC_DIRECTORY_FILTERS: AacDirectoryEnabledFilters = {
  search: true,
  usage: true,
  tags: true,
  maturity: true,
  sort: true,
};

const FILTER_KEYS = Object.keys(DEFAULT_AAC_DIRECTORY_FILTERS) as Array<
  keyof AacDirectoryEnabledFilters
>;

export function resolveDirectoryFilters(
  filters: AacDirectoryFiltersConfig | null | undefined
): AacDirectoryEnabledFilters {
  const resolved = { ...DEFAULT_AAC_DIRECTORY_FILTERS };
  if (!filters) return resolved;

  for (const key of FILTER_KEYS) {
    const value = filters[key];
    if (typeof value === "boolean") resolved[key] = value;
  }
  return resolved;
}
