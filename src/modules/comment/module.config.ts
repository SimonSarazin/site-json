import type { ModuleConfigSchema } from "@/lib/modules";

/**
 * Configuration du module comment.
 *
 * type "core" OBLIGATOIRE : un seul module « optional » suffit à faire basculer TOUTE la
 * construction de routes client en mode asynchrone, ce qui provoque une régression
 * d'hydratation app-wide (header et sections dupliqués). `coform` prouve qu'un module peut
 * avoir des routes ET rester "core".
 */
const config: ModuleConfigSchema = {
  name: "comment",
  type: "core",
  enabled: true
};

export default config;
