import { lazy } from "vite-preload";

/**
 * Ce que partagent les boutons d'une fiche qui ouvrent l'espace de discussion du commun : celui de
 * la fiche (`CommunDiscussionControl`) et celui de chaque palier (`CommunMilestoneDiscussionButton`).
 *
 * La modale n'arrive qu'à l'ouverture : le fil, le composer et le rendu markdown ne sont pas le
 * prix d'une fiche qu'on ne fait que lire. Les boutons, eux, ne tiennent qu'à l'entrée légère du
 * module comment.
 *
 * `lazy` vient de `vite-preload` (pas `React.lazy`), comme partout dans le dépôt : il enregistre le
 * morceau auprès du rendu serveur, et il donne `preload()` — ce dont les boutons se servent, au
 * survol et au focus. Précédent : `AacDepositButton`.
 */
export const SpaceModal = lazy(() => import("@/modules/comment/components/panel/SpaceModal"));

/** Préchauffe le code de la modale. Un échec n'est rien ici : l'import sera retenté à l'ouverture. */
export function prechaufferLaModale() {
    void SpaceModal.preload().catch(() => undefined);
}

/** L'attribut par lequel un bouton se NOMME, pour que le focus lui revienne à la fermeture. */
export const OPENER_ATTRIBUTE = "data-discussion-opener";

/** Le nom du bouton de discussion d'un palier — celui de la ligne de dépense qu'il affiche. */
export function milestoneOpener(lineKey: string): string {
    return `palier:${lineKey}`;
}

/**
 * Le nom du bouton de discussion d'une ligne de dépense DANS LE FORMULAIRE d'édition. Distinct de
 * celui du palier de la fiche : les deux sont à l'écran en même temps — la fiche derrière la modale
 * du formulaire —, et le focus doit revenir à celui d'où l'on a ouvert, pas à son jumeau caché.
 */
export function formMilestoneOpener(lineKey: string): string {
    return `formulaire:palier:${lineKey}`;
}

/**
 * Le bouton qui porte ce nom, s'il est encore à l'écran. Comparé en valeur, sans sélecteur : un nom
 * relu de l'historique n'a pas à être échappé pour être cherché.
 */
export function findOpener(name: string | null): HTMLElement | null {
    if (name === null) return null;
    for (const element of Array.from(document.querySelectorAll<HTMLElement>(`[${OPENER_ATTRIBUTE}]`))) {
        if (element.getAttribute(OPENER_ATTRIBUTE) === name) return element;
    }
    return null;
}
