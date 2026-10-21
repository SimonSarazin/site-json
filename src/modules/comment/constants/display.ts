/**
 * Constantes de rendu du fil.
 *
 * Elles sont ici, et pas dispersées dans les composants, parce que le groupement des messages
 * et le retrait des réponses doivent rester cohérents entre le fil, le panneau et l'aperçu.
 */

/**
 * Fenêtre de regroupement : deux messages consécutifs du même auteur postés à moins de ce
 * délai forment un seul bloc (un seul avatar, un seul en-tête). Valeur reprise du
 * comportement de Discord, qui regroupe sur environ sept minutes.
 */
export const GROUP_WINDOW_SECONDS = 7 * 60;

/**
 * Profondeur maximale de **retrait visuel**. La donnée, elle, est un arbre illimité : au-delà
 * de cette profondeur le message s'affiche à plat, précédé d'une ligne de contexte citant son
 * parent.
 *
 * **La même à toutes les largeurs**, et c'est un choix (arbitré le 28/09) : le fil gardait un
 * seul niveau sur mobile, ce qui ramenait l'arbre à une liste de réponses citées. Garder trois
 * niveaux ne coûte presque rien quand le retrait se resserre avec la largeur DU FIL
 * (`styles.css`, container query) : mesuré sur un fil de 358 px, 248 px de texte au niveau 3.
 * Trois, parce que c'est la profondeur maximale relevée en base — aucune citation aujourd'hui.
 */
export const MAX_VISUAL_DEPTH = 3;

/**
 * Au-delà de ce nombre de réponses, une branche part repliée — si elles sont TOUTES lues.
 *
 * Le repli d'office se fondait sur la profondeur : il masquait aussi la réponse qu'on venait
 * d'écrire, puisque son propre message n'est jamais « non lu ». Une branche courte n'encombre
 * rien, et une branche qui porte du nouveau ne doit jamais se refermer d'elle-même.
 */
export const AUTO_COLLAPSE_MIN_REPLIES = 5;

/** Longueur maximale de l'extrait de parent affiché dans une ligne de contexte. */
export const CONTEXT_QUOTE_LENGTH = 90;
