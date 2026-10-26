/**
 * Ré-export transitoire — les motifs de signalement vivent désormais dans le module `comment`,
 * qui les partage entre le fil et le panneau « Discussions ».
 *
 * Les libellés (`reportDialog.reasons.*`) restent résolus dans le namespace i18n de l'appelant :
 * le déplacement ne change rien pour `news`. Ce fichier disparaît au rebranchement (J8).
 */
export { REPORT_REASONS, type ReportReason } from "@/modules/comment/constants/reportReasons";
