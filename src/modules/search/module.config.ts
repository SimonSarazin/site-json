import type { ModuleConfigSchema } from "@/lib/modules";
import { PageFiltersProvider } from "./contexts/pageFilters";

/**
 * Configuration du module search.
 *
 * Pas de `routes.tsx` — le module expose ses fonctionnalités exclusivement
 * via ses sections (`searchPro`, `searchProStatic`, `filters`, etc.) chargées
 * par le `SectionRenderer` global. Le `PageProvider` partage le state des
 * filtres entre sections d'une même page (cf. `contexts/pageFilters.ts`).
 */
const config: ModuleConfigSchema = {
  name: "search",
  type: "core",
  enabled: true,
  PageProvider: PageFiltersProvider,
};

export default config;
