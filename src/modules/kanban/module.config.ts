import type { ModuleConfigSchema } from "@/lib/modules";

/**
 * Configuration du module kanban : le kanban de co-kanban, branché sur l'élément (organisation
 * ou projet) qui porte le site.
 *
 * type "core" OBLIGATOIRE : un seul module « optional » suffit à faire basculer TOUTE la
 * construction de routes client en mode asynchrone, ce qui casse l'hydratation de toute
 * l'application (cf. `comment/module.config.ts`). Les routes ne sont montées que sur les sites
 * qui déclarent `config.kanban` (cf. `routes.tsx`).
 */
const config: ModuleConfigSchema = {
  name: "kanban",
  type: "core",
  enabled: true,
};

export default config;
