/**
 * Entrée LÉGÈRE du module, pour une fiche ou un formulaire qui pose un bouton « Discussion ».
 *
 * De quoi compter, ouvrir et monter la modale, sans rien de plus : ni le fil, ni le composer, ni le
 * rendu markdown. Ceux-là n'arrivent qu'à l'ouverture, par un import DIFFÉRÉ de la modale elle-même
 * (`lib/spaceModalChunk`, le `lazy` de `vite-preload`). Importer l'entrée complète (`@/modules/comment`)
 * pour un bouton ferait payer le fil entier à chaque fiche affichée, y compris à qui ne l'ouvre jamais.
 *
 * Rien de ce qui est exporté ici ne rend de texte : l'enregistrement des libellés reste l'affaire
 * de l'entrée complète, et de la modale quand elle arrive seule.
 */
export { useDiscussionSpaceQuery } from "./hooks/useDiscussionSpaceQuery";
export { useSpaceLauncher, type SpaceLauncher } from "./hooks/useSpaceLauncher";
export { lineDiscussion, questionDiscussion, type EntryDiscussion } from "./lib/space";
export type { SpaceHostRank } from "./lib/spaceHosts";
export { SpaceModalHost, type SpaceModalHostProps } from "./components/panel/SpaceModalHost";
export { OPENER_ATTRIBUTE, findOpener } from "./lib/opener";
export { preloadSpaceModal } from "./lib/spaceModalChunk";
export type { SpaceRef, SpaceSubject } from "./types";
