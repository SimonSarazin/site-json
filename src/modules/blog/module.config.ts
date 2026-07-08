import type { ModuleConfigSchema } from "@/lib/modules";

/**
 * Module blog/articles — piloté par les DONNÉES (POI `type:"article"` scopés costum, cf.
 * docs/module-articles-blog.md). Expose :
 *  - une SECTION config-driven `articleFeed` (fil paginé, île client calquée sur agenda) ;
 *  - des ROUTES `/blog/:slug` (+ `/blog/id/:id` pour les articles sans slug) — reader + SEO SSR.
 *
 * type "core" OBLIGATOIRE : ce module a un routes.tsx, mais rester "core" garde la construction de routes
 * client en mode SYNCHRONE. Un module "optional" basculerait TOUTE l'app en async (régression d'hydratation
 * app-wide — cf. note agenda/module.config.ts). i18n chargé en side-effect (import "../i18n").
 */
const config: ModuleConfigSchema = {
  name: "blog",
  type: "core",
  enabled: true,
};

export default config;
