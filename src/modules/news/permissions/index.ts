/**
 * Module news/permissions - Exports
 */

// Types
export type { NewsPermissions } from "./types";

// Defaults
export { DEFAULT_NEWS_PERMISSIONS } from "./defaults";

// Calculators (pour usage avancé / tests)
export { calculateNewsPermissions } from "./calculators/news";

// Note: Pour utiliser les permissions news, importer le register:
// import "@/modules/news/permissions/register";
