import { OPENER_ATTRIBUTE, findOpener, preloadSpaceModal } from "@/modules/comment/launch";

/**
 * Ce que partagent les boutons d'une fiche qui ouvrent l'espace de discussion du commun : celui de
 * la fiche (`CommunDiscussionControl`) et celui de chaque palier (`CommunMilestoneDiscussionButton`).
 *
 * La modale, son préchauffage et le nom des boutons viennent de l'entrée légère du module comment
 * (`SpaceModalHost`) : un formulaire en pose aussi, sur ses questions, et la modale d'un espace doit
 * rester UNE par page. Elle n'arrive qu'à l'ouverture, par un import différé.
 */
export { OPENER_ATTRIBUTE, findOpener };

/** Préchauffe le code de la modale. Un échec n'est rien ici : l'import sera retenté à l'ouverture. */
export const prechaufferLaModale = preloadSpaceModal;

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
