/**
 * Ancres DOM des sections de l'onglet home — partagées entre la section qui les
 * POSE et le hero qui les VISE.
 *
 * En littéraux dupliqués des deux côtés, renommer une section casserait le
 * bouton correspondant en silence : `scrollToSection` ne trouverait plus rien
 * et le clic ne ferait simplement rien.
 */
export const AMPLI_SECTION_IDS = {
  /** « Proposez votre idée » — porte le formulaire de proposition en ligne. */
  FEATURES: "ampli-feature",
  /** « Messages populaires » — l'annuaire des propositions (MeeteemSection). */
  MESSAGES: "ampli-messages-section",
} as const;

export type AmpliSectionId = (typeof AMPLI_SECTION_IDS)[keyof typeof AMPLI_SECTION_IDS];
