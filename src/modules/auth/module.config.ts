import type { ModuleConfigSchema } from "@/lib/modules";

/**
 * Configuration du module auth.
 *
 * Type: core — chargé en eager (synchrone) : l'auth (modal + routes) doit être
 * disponible sans flash, sur tous les sites.
 */
const config: ModuleConfigSchema = {
  name: "auth",
  type: "core",
  enabled: true,
};

export default config;
