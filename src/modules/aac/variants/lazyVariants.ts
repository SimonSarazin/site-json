import { lazy } from "vite-preload";

/**
 * Interfaces code-splittées de l'AAC, déclarées ici (chargé par `routes.tsx`, chunk d'entrée)
 * et non dans leurs registres : un `import()` écrit dans le chunk d'une page lui fait perdre sa
 * façade de manifest, donc ses modulepreload SSR. Règle tenue par le préflight `lazy-entry-facades`.
 * Chaque entrée est un `lazy(() => import("chemin/statique"))` direct (cf. `@/lib/variants`).
 */
export const EDITORIAL_VARIANTS = {
  /** Fiche à onglets, police d'affichage à empattement (maquette projets.re). */
  detail: lazy(() => import("./editorial/CommunDetailEditorial")),
  /** Sans image, titre en police d'affichage, collecte en pied de carte. */
  card: lazy(() => import("./editorial/CommunCardEditorial")),
  row: lazy(() => import("./editorial/CommunRowEditorial")),
  skeleton: lazy(() => import("./editorial/DirectorySkeletonEditorial")),
  /** Barre de filtres au-dessus des résultats, titre en police d'affichage. */
  shell: lazy(() => import("./editorial/DirectoryShellEditorial")),
};
