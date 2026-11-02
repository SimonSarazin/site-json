import { lazy } from "vite-preload";

/**
 * Boîtes de dialogue code-splittées du module : elles ne s'ouvrent qu'au geste. Déclarées ICI
 * (chargé par `routes.tsx`, chunk d'entrée) et non dans les vues : un `import()` écrit dans le
 * chunk d'une page lui fait perdre sa façade de manifest, donc ses modulepreload SSR (préflight
 * `lazy-entry-facades`, même parti que `src/modules/aac/variants/lazyVariants.ts`).
 */
export const ColumnVisibilityDialog = lazy(() => import("./components/board/ColumnVisibilityDialog"));
export const CardMoveDialog = lazy(() => import("./components/board/CardMoveDialog"));
// La fiche de carte : un formulaire complet et ses éditeurs, ouverts sur la route fille d'une carte.
export const CardDialog = lazy(() => import("./components/card/CardDialog"));
// La gestion des jalons du projet : menu « ⋯ » du tableau des actions, « Ajouter un jalon » de la vue Jalons.
export const MilestonesDialog = lazy(() => import("./components/milestones/MilestonesDialog"));
