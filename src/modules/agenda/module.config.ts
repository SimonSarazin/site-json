import type { ModuleConfigSchema } from "@/lib/modules";

/**
 * Module agenda — n'expose qu'une section (`agenda`) rendue par le SectionRenderer global ;
 * pas de routes.tsx ni de PageProvider. i18n chargé en side-effect par la section (`import "../i18n"`).
 *
 * type "core" OBLIGATOIRE : un module "optional" (sans routes à lazy-loader, ce qui est notre cas)
 * suffit à rendre `hasOptional` vrai → bascule TOUTE la construction de routes client en mode async
 * (`buildRoutesAsync` + loaders sur chaque route) → régression d'hydratation app-wide (header/sections
 * dupliqués) + navigation cassée. "core" garde le client en build synchrone. L'agenda n'ayant pas de
 * routes.tsx, "optional" n'apportait rien.
 */
const config: ModuleConfigSchema = {
  name: "agenda",
  type: "core",
  enabled: true,
};

export default config;
