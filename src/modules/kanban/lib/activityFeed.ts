/**
 * Fil d'activité d'un tableau : mise en forme PURE du journal (`kanbanActivities`), déjà servi
 * par `board/sync`. Repris de co-kanban (`lib/activityFeed.ts`) pour la Vue d'ensemble.
 *
 * Sans le marqueur « vu » de co-kanban : il servait la cloche de sa barre applicative, qu'un site
 * n'a pas. La Vue d'ensemble montre les dernières écritures, sans rien compter de « nouveau ».
 */
import { memberDisplayName } from '@/modules/kanban/lib/memberName';
import type { Activity, ActivityVerb, Member } from '@/modules/kanban/types';

/**
 * Auteur des activités qui CONSTATENT un changement fait hors du kanban (Kanban gestion, aap.js)
 * sur un tableau relié : `board/sync` journalise alors un `board.updated` au nom de
 * `communecter`. Ce n'est pas un citoyen : aucun membre ne le porte, il faut le nommer.
 */
export const COMMUNECTER_ACTOR_ID = 'communecter';

export function isCommunecterActor(actorId: string): boolean {
  return actorId === COMMUNECTER_ACTOR_ID;
}

/** Nom de l'auteur d'une activité : « Communecter », un membre par son nom, ou le libellé de repli. */
export function activityActorName(actorId: string, members: readonly Pick<Member, 'userId' | 'profile'>[], labels: { communecter: string; unknown: string }): string {
  if (isCommunecterActor(actorId)) return labels.communecter;
  const member = members.find((entry) => entry.userId === actorId);
  return memberDisplayName(member?.profile, labels.unknown);
}

/** Journal du plus RÉCENT au plus ancien, `rev` en départ d'égalité sur `at`. */
export function sortActivitiesDesc(activities: readonly Activity[]): Activity[] {
  return [...activities].sort((a, b) => b.at - a.at || b.rev - a.rev);
}

/**
 * Clé i18n du verbe, dans le même arbre que le catalogue (`activity.verbs.card.moved`) : le verbe
 * contient déjà un point, le séparateur de clés d'i18next.
 */
export function activityVerbKey(verb: ActivityVerb): string {
  return `activity.verbs.${verb}`;
}

/**
 * Clé i18n du LIBELLÉ d'une activité : celle de son verbe, sauf quand le verbe dirait faux ou trop
 * peu.
 *
 * - `card/archive` est journalisé en `card.deleted` avec `payload.archived: true` : annoncer
 *   « Carte supprimée » ferait croire à une perte de données qui n'a pas eu lieu.
 * - Deux `board.updated` d'un tableau relié ne modifient pas « le tableau » : l'un constate une
 *   écriture faite dans Communecter (`reason: externalChange`), l'autre touche les jalons.
 * - `role.updated` couvre trois gestes que son payload distingue (créé, supprimé, attribué) ; une
 *   forme inconnue garde le libellé générique.
 */
export function activityLabelKey(activity: Pick<Activity, 'verb' | 'payload'>): string {
  if (activity.verb === 'card.deleted' && activity.payload.archived === true) return 'activity.verbs.card.archived';
  if (activity.verb === 'board.updated') {
    if (activity.payload.reason === 'externalChange') return 'activity.verbs.board.externalChange';
    const fields = activity.payload.fields;
    if (Array.isArray(fields) && fields.includes('milestones')) return 'activity.verbs.board.milestones';
  }
  if (activity.verb === 'role.updated') {
    if (activity.payload.created === true) return 'activity.verbs.role.created';
    if (activity.payload.deleted === true) return 'activity.verbs.role.deleted';
    if (typeof activity.payload.member === 'object' && activity.payload.member !== null) return 'activity.verbs.role.assigned';
  }
  return activityVerbKey(activity.verb);
}
