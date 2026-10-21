/**
 * Ré-export transitoire — la palette des 8 réactions vit désormais dans le module `comment`,
 * qui la partage entre le fil et le panneau « Discussions ».
 *
 * Les composants `news` continuent de résoudre leurs libellés (`reactionsTypes.*`) dans LEUR
 * namespace i18n : le déplacement ne change rien pour eux. Ce fichier disparaît au rebranchement
 * de `news` sur le module générique (J8).
 */
export { voteTypes, voteTypeMap, type VoteType } from "@/modules/comment/constants/voteTypes";
