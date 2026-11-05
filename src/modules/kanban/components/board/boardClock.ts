/**
 * Horloge des echeances du tableau — logique PURE (`tests/unit/boardClock.test.ts`).
 *
 * Tout ce que le tableau deduit de l'instant courant se decide a la JOURNEE :
 * « en retard » (`isOverdue`, RG-25), fenetres du filtre « Échéance », annee
 * ecrite ou non sur l'echeance courte, semaine courante de la chronologie.
 * Rafraichir l'horloge chaque minute faisait pourtant se rendre de nouveau
 * toutes les cartes affichees, 60 fois par heure, pour un resultat identique :
 * 430 ms de tache longue par minute sur le projet CMS (1 009 actions).
 */
import { daysUntil } from '@/modules/kanban/lib/dates';

/**
 * Prochaine valeur de l'horloge : `previous` tant que `now` tombe le MEME jour
 * (au sens du moteur d'echeances, `daysUntil`), `now` sinon.
 *
 * Le meme jour dans les DEUX fuseaux du moteur : UTC (board kanban) et celui du
 * navigateur (board-lien, cf. `lib/dates`). Une horloge qui ne changeait qu'a
 * minuit UTC laissait une action due la veille hors de « En retard » jusqu'a
 * 4 h du matin a La Reunion. L'horloge change ainsi au plus deux fois par jour.
 *
 * Renvoyer la meme valeur laisse l'etat React inchange : aucun rendu. `0` est
 * l'horloge inconnue du rendu serveur et du premier rendu client ; elle est
 * toujours remplacee.
 */
export function nextDayClock(previous: number, now: number): number {
  if (previous > 0 && now > 0 && daysUntil(previous, now) === 0 && daysUntil(previous, now, 'local') === 0) {
    return previous;
  }
  return now;
}
