/**
 * Réglages de présentation PARTAGÉS par les deux modes de l'annuaire.
 *
 * Un même commun doit afficher le même montant et replier ses tags au même rang,
 * qu'on le lise en carte ou en ligne : la grille et la liste sont deux vues d'un
 * seul jeu de faits, pas deux gabarits indépendants.
 */

/**
 * Le legacy formate par `toLocaleString("fr-FR")` puis colle une icône `fa-eur`.
 * D'où un formateur DÉCIMAL suivi d'un « € » — et non `style:"currency"`, qui
 * insère une espace insécable étroite et ne rendrait pas la même chose.
 */
const amount = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });

export const formatAacAmount = (value: number): string => amount.format(value);

/** Tags affichés avant le repli dans la pastille « … » (`nbTagToShow` du legacy). */
export const AAC_VISIBLE_TAGS = 2;

/**
 * Largeur de la barre de collecte, bornée à 100 %.
 *
 * Le POURCENTAGE affiché, lui, ne l'est pas : un commun sur-financé doit se lire
 * « 110 % » sans déborder de sa gouttière.
 */
export const progressBarWidth = (percent: number): number =>
  Math.min(100, Math.max(0, percent));
