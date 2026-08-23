/**
 * Sections CONTAINERS : le registre des sections qui en contiennent d'autres, et les parcours
 * qui les traversent.
 *
 * POURQUOI UN MODULE À PART : une section imbriquée dans un `tabs` ou un `gridLayout` est une
 * section à part entière — elle a ses `baseParams`, elle interroge le backend, elle doit être
 * préchargée en SSR et surveillée par les gardes. Tout code qui parcourt `page.sections` À PLAT
 * la rate SILENCIEUSEMENT. Le registre vivait dans `buildRoutes.tsx` (prefetch SSR) et n'était
 * donc pas atteignable par les préflights, qui itéraient à plat et ne voyaient pas 11 sections du
 * parc — défaut trouvé en revue de la MR !35, où les deux listes de `/actualites` sortaient du
 * champ de la garde d'impact au moment même où on réécrivait leur périmètre.
 *
 * Ajouter un container = ajouter UNE ligne à {@link SECTION_EXTRACTORS} ; le prefetch et les
 * gardes le voient du même coup.
 */

export interface SectionLike {
  type: string;
  props?: Record<string, unknown>;
}

/**
 * Registry des extracteurs de sections imbriquées.
 * Pour ajouter un nouveau container : ajouter 1 ligne ici.
 */
export const SECTION_EXTRACTORS: Record<string, (props: Record<string, unknown>) => unknown[]> = {
  gridLayout: (p) => [p.leftSection, p.rightSection],
  tabs: (p) =>
    (Array.isArray(p.tabs) ? p.tabs : []).flatMap((t: { content: unknown }) =>
      Array.isArray(t.content) ? t.content : [],
    ),
};

/** Les sections filles d'un container, ou `[]` si `section` n'en est pas un. */
function enfantsDe(section: SectionLike): SectionLike[] {
  const extraire = SECTION_EXTRACTORS[section.type];
  if (!extraire || !section.props) return [];
  return extraire(section.props).filter(Boolean) as SectionLike[];
}

/**
 * Recherche récursive des sections d'un ou plusieurs types, containers traversés.
 *
 * Un container n'est PAS lui-même un résultat : on ne descend dedans que s'il ne fait pas
 * partie des `types` cherchés (un container ne peut pas être une section de recherche).
 */
export function findSectionsOfTypes(
  sections: SectionLike[],
  types: ReadonlySet<string>,
): SectionLike[] {
  const result: SectionLike[] = [];
  for (const section of sections) {
    if (types.has(section.type)) result.push(section);
    else result.push(...findSectionsOfTypes(enfantsDe(section), types));
  }
  return result;
}

/**
 * Parcours EXHAUSTIF, en ordre de document : TOUTE section de l'arbre, containers compris ET
 * traversés. Destiné aux gardes/outils qui doivent voir la totalité de la surface d'un site
 * (`config-probe`, projection d'impact, audits) — là où {@link findSectionsOfTypes} sert le
 * prefetch, qui ne cherche que des types précis.
 *
 * Le container est émis AVANT ses filles : un consommateur qui veut ignorer les containers
 * filtre sur `SECTION_EXTRACTORS[section.type]`.
 */
export function walkSections(sections: SectionLike[]): SectionLike[] {
  const out: SectionLike[] = [];
  for (const section of sections) {
    out.push(section);
    out.push(...walkSections(enfantsDe(section)));
  }
  return out;
}
