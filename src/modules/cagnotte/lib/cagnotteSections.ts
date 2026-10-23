/** Types de sections du module cagnotte. Fichier sans dépendance : importable sans charger le module. */
export const CAGNOTTE_SECTION_TYPES = new Set<string>([
  "actions",
  "finance",
  "actions-summary",
  "finance-summary",
]);

/**
 * Une section cagnotte figure-t-elle dans la liste ? Descend dans `leftSections`/`rightSections`
 * (`profile-tab-layout`) et `props.leftSections`/`props.rightSections` (`cagnotte-layout`).
 */
export function hasCagnotteSection(sections: unknown[]): boolean {
  if (!Array.isArray(sections)) return false;
  for (const raw of sections) {
    if (!raw || typeof raw !== "object") continue;
    const section = raw as {
      type?: string;
      leftSections?: unknown[];
      rightSections?: unknown[];
      props?: { leftSections?: unknown[]; rightSections?: unknown[] };
    };
    if (section.type && CAGNOTTE_SECTION_TYPES.has(section.type)) return true;
    if (Array.isArray(section.leftSections) && hasCagnotteSection(section.leftSections)) return true;
    if (Array.isArray(section.rightSections) && hasCagnotteSection(section.rightSections)) return true;
    if (Array.isArray(section.props?.leftSections) && hasCagnotteSection(section.props.leftSections)) return true;
    if (Array.isArray(section.props?.rightSections) && hasCagnotteSection(section.props.rightSections)) return true;
  }
  return false;
}
