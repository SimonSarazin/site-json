import type { ModuleConfigSchema } from "@/lib/modules";

/**
 * Configuration du module cagnotte
 *
 * Type: core - Module pour le financement collaboratif de projets via milestones.
 * Gère le flux paiement (Stripe + HelloAsso), la sync `projects.oceco.milestones` ↔
 * `answers.aapStep1.depense`, et les sections JSON `actions`, `finance`,
 * `actions-summary`, `finance-summary` exposées via `SectionRenderer`.
 *
 * Chargé en eager (synchrone) car les sections cagnotte peuvent apparaître sur
 * des pages publiques et profil sans flash de chargement.
 */
const config: ModuleConfigSchema = {
  name: "cagnotte",
  type: "core",
  enabled: true,
};

export default config;
