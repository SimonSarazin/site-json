import type { ModuleConfigSchema } from "@/lib/modules";

/**
 * Module admin — page d'Administration config-driven (jumeau du module profil).
 * Type `core` (chargé eager, routes synchrones) : la route `admin` doit exister au 1er rendu.
 */
const config: ModuleConfigSchema = {
  name: "admin",
  type: "core",
  enabled: true,
};

export default config;
