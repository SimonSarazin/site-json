/**
 * Module cagnotte/prefetch — fonctions de pré-chargement SSR.
 */
export {
  prefetchFundingEnvelope,
  type PrefetchFundingEnvelopeParams,
} from "./prefetchFundingEnvelope";

/**
 * Types de sections JSON consommés par le module cagnotte.
 * Permet aux loaders SSR (profil, etc.) de détecter qu'une page/tab nécessite
 * un prefetch de `fundingEnvelope`.
 */
export const CAGNOTTE_SECTION_TYPES = new Set<string>([
  "actions",
  "finance",
  "actions-summary",
  "finance-summary",
]);

/**
 * Walk récursif sur une liste de sections JSON pour détecter la présence
 * d'au moins une section cagnotte (inclut le contenu de `profile-tab-layout`
 * via ses `leftSections` / `rightSections`).
 */
export function hasCagnotteSection(sections: unknown[]): boolean {
  if (!Array.isArray(sections)) return false;
  for (const raw of sections) {
    if (!raw || typeof raw !== "object") continue;
    const section = raw as {
      type?: string;
      leftSections?: unknown[];
      rightSections?: unknown[];
    };
    if (section.type && CAGNOTTE_SECTION_TYPES.has(section.type)) return true;
    if (Array.isArray(section.leftSections) && hasCagnotteSection(section.leftSections)) return true;
    if (Array.isArray(section.rightSections) && hasCagnotteSection(section.rightSections)) return true;
  }
  return false;
}
