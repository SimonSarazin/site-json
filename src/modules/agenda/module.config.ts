import type { ModuleConfigSchema } from "@/lib/modules";

/**
 * Module agenda — n'expose qu'une section (`agenda`) rendue par le SectionRenderer global ;
 * pas de routes ni de PageProvider. i18n chargé en side-effect par la section (`import "../i18n"`).
 */
const config: ModuleConfigSchema = {
  name: "agenda",
  type: "optional",
  enabled: true,
};

export default config;
