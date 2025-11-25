import type { ModuleConfigSchema } from "@/lib/modules";

/**
 * Configuration du module News
 *
 * Module indépendant pour la gestion des actualités, commentaires et réactions.
 * Extrait du module profil pour améliorer la modularité et la réutilisabilité.
 */
export default {
  name: "news",
  type: "core",
  enabled: true,
} satisfies ModuleConfigSchema;