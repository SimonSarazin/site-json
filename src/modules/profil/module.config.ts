import type { ModuleConfigSchema } from "@/lib/modules";

/**
 * Configuration du module profil
 *
 * Type: core - Ce module est chargé en eager (synchrone)
 * pour éviter tout flash de chargement lors de l'accès aux profils
 */
const config: ModuleConfigSchema = {
  name: "profil",
  type: "core",
  enabled: true
};

export default config;
