/**
 * Entrée LÉGÈRE du module, pour une fiche qui pose un bouton « Discussion ».
 *
 * De quoi compter et ouvrir, sans rien de plus : ni le fil, ni le composer, ni le rendu markdown.
 * Ceux-là n'arrivent qu'à l'ouverture, par un import DIFFÉRÉ de la modale elle-même —
 * `lazy(() => import("@/modules/comment/components/panel/SpaceModal"))`, le `lazy` de
 * `vite-preload`. Importer l'entrée complète (`@/modules/comment`) pour un bouton ferait payer le
 * fil entier à chaque fiche affichée, y compris à qui ne l'ouvre jamais.
 *
 * Rien de ce qui est exporté ici ne rend de texte : l'enregistrement des libellés reste l'affaire
 * de l'entrée complète, et de la modale quand elle arrive seule.
 */
export { useDiscussionSpaceQuery } from "./hooks/useDiscussionSpaceQuery";
export { useSpaceLauncher, type SpaceLauncher } from "./hooks/useSpaceLauncher";
export type { SpaceRef } from "./types";
