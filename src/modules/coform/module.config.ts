import type { ModuleConfigSchema } from "@/lib/modules";

/**
 * Configuration du module coform
 *
 * Type: core - Module pour l'affichage et la gestion des formulaires dynamiques CoForm
 * Gère la conversion des données CoForm vers react-hook-form + zod
 */
const config: ModuleConfigSchema = {
  name: "coform",
  type: "core",
  enabled: true
};

export default config;
