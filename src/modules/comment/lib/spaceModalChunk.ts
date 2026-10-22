import { lazy } from "vite-preload";

/**
 * Le morceau de la modale d'un espace : son import DIFFÉRÉ, et de quoi le préchauffer.
 *
 * La modale n'arrive qu'à l'ouverture : le fil, le composer et le rendu markdown ne sont pas le prix
 * d'une page qu'on ne fait que lire. Ce qui l'ouvre — un bouton, un hôte (`SpaceModalHost`) — ne
 * tient qu'à l'entrée légère du module (`launch`).
 *
 * `lazy` vient de `vite-preload` (pas `React.lazy`), comme partout dans le dépôt : il enregistre le
 * morceau auprès du rendu serveur, et il donne `preload()` — ce dont les boutons se servent, au
 * survol et au focus.
 */
export const SpaceModalChunk = lazy(() => import("../components/panel/SpaceModal"));

/** Préchauffe le code de la modale. Un échec n'est rien ici : l'import sera retenté à l'ouverture. */
export function preloadSpaceModal(): void {
  void SpaceModalChunk.preload().catch(() => undefined);
}
