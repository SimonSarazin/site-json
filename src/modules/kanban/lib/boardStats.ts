/**
 * Selecteurs de SYNTHESE d'un tableau (vue d'ensemble, DESIGN.md §6).
 *
 * Tout est PUR : `(instantane, now) -> nombres`. Aucune lecture d'horloge
 * implicite (`now` est un parametre, defaut `nowTimestamp()`), aucun acces au
 * cache, aucun `Intl` — le formatage et les libelles appartiennent a l'interface.
 * C'est ce qui rend ces fonctions testables sans React et sans reseau, et c'est
 * la seule facon d'etre sur que « 62 % » et « 3 en retard » disent la meme chose
 * dans la vue d'ensemble, dans la table et dans la chronologie.
 *
 * Une regle de fond : ON NE COMPTE QUE CE QUE LE BACKEND A DEJA TRANCHE. La
 * cloture d'une carte est `completedAt` / `status: 'complete'`, pose par le
 * serveur ; on ne la rededuit pas de la colonne, sans quoi deux ecrans
 * afficheraient deux avancements differents pour le meme tableau.
 */
import { cardStatusesFor, dateZoneFor, snapshotSource } from '@/modules/kanban/lib/boardSource';
import { daysUntil, isOverdue, nowTimestamp, type DateZone } from '@/modules/kanban/lib/dates';
import { type BoardSnapshot, type Card, type CardStatus, type Column, type Member } from '@/modules/kanban/types';

/** Horizon de « a echeance cette semaine » : aujourd'hui inclus, 7 jours. */
export const DUE_THIS_WEEK_DAYS = 7;

/** Une carte est close quand le serveur l'a close — cf. l'en-tete du fichier. */
export function isCardDone(card: Pick<Card, 'completedAt' | 'status'>): boolean {
  return card.completedAt !== null || card.status === 'complete';
}

/**
 * « En retard » d'une CARTE (RG-25) : echeance passee ET carte non close — LE
 * seul endroit qui le decide, pour que la vue d'ensemble, les filtres et les
 * compteurs disent la meme chose.
 *
 * `isOverdue` seul ne suffit pas : il ne voit que `completedAt`, or une action
 * « Terminé » d'un board-lien close avant l'historique a `completedAt: null` et
 * `status: 'complete'` (§11.9 E11) — 91 % des actions terminees en base.
 *
 * @param zone fuseau du jour civil du tableau (`dateZoneFor`).
 */
export function isCardOverdue(
  card: Pick<Card, 'dueDate' | 'completedAt' | 'status'>,
  now: number = nowTimestamp(),
  zone: DateZone = 'utc',
): boolean {
  return !isCardDone(card) && isOverdue(card.dueDate, card.completedAt, now, zone);
}

/** Pourcentage entier, 0 quand il n'y a rien a mesurer (jamais `NaN`). */
export function percentOf(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((part / total) * 100);
}

export interface BoardProgress {
  total: number;
  done: number;
  /** 0 a 100, arrondi. */
  percent: number;
}

export function boardProgress(snapshot: BoardSnapshot): BoardProgress {
  const total = snapshot.cards.length;
  const done = snapshot.cards.filter(isCardDone).length;
  return { total, done, percent: percentOf(done, total) };
}

/** Cartes dont l'echeance est passee et qui ne sont pas closes (RG-25). */
export function overdueCards(snapshot: BoardSnapshot, now: number = nowTimestamp()): Card[] {
  const zone = dateZoneFor(snapshot.capabilities.source);
  return snapshot.cards.filter((card) => isCardOverdue(card, now, zone));
}

/**
 * Cartes a rendre dans les sept jours, aujourd'hui compris.
 *
 * Le retard n'en fait PAS partie : c'est un cartouche distinct dans la vue
 * d'ensemble, et compter une carte dans les deux ferait un total superieur au
 * nombre de cartes.
 */
export function dueThisWeekCards(snapshot: BoardSnapshot, now: number = nowTimestamp()): Card[] {
  const zone = dateZoneFor(snapshot.capabilities.source);
  return snapshot.cards.filter((card) => {
    if (isCardDone(card) || card.dueDate === null) return false;
    const days = daysUntil(card.dueDate, now, zone);
    return days >= 0 && days < DUE_THIS_WEEK_DAYS;
  });
}

/** Cartes sans personne assignee — la file d'attente reelle d'un tableau. */
export function unassignedCards(snapshot: BoardSnapshot): Card[] {
  return snapshot.cards.filter((card) => card.assignees.length === 0);
}

export interface ColumnBreakdownEntry {
  column: Column;
  total: number;
  done: number;
  percent: number;
}

/**
 * Repartition par colonne, dans l'ORDRE DU TABLEAU (`rank`, puis `_id` en
 * depart d'egalite — Mongo n'a aucun tri stable, blueprint §5).
 */
export function columnBreakdown(snapshot: BoardSnapshot): ColumnBreakdownEntry[] {
  const columns = [...snapshot.columns].sort(
    (a, b) => a.rank - b.rank || (a._id < b._id ? -1 : a._id > b._id ? 1 : 0),
  );
  return columns.map((column) => {
    const cards = snapshot.cards.filter((card) => card.columnId === column._id);
    const done = cards.filter(isCardDone).length;
    return { column, total: cards.length, done, percent: percentOf(done, cards.length) };
  });
}

export interface StatusBreakdownEntry {
  status: CardStatus;
  total: number;
  /** Part du total des cartes du tableau, pas du seul statut. */
  percent: number;
}

/**
 * Repartition par statut, dans l'ordre d'avancement et TOUJOURS COMPLETE :
 * un statut a zero reste dans la liste, sinon la legende change de forme d'un
 * tableau a l'autre et l'oeil perd son repere.
 *
 * Complete sur les statuts que la SOURCE connait (`cardStatusesFor`) : une
 * action Communecter n'est jamais « en recherche », une ligne a zero perpetuel
 * n'y dirait rien.
 */
export function statusBreakdown(snapshot: BoardSnapshot): StatusBreakdownEntry[] {
  const total = snapshot.cards.length;
  return cardStatusesFor(snapshotSource(snapshot)).map((status) => {
    const count = snapshot.cards.filter((card) => card.status === status).length;
    return { status, total: count, percent: percentOf(count, total) };
  });
}

export interface ContributorLoadEntry {
  userId: string;
  /** `null` si la personne n'est plus membre (cartes d'un compte retire). */
  member: Member | null;
  total: number;
  done: number;
  overdue: number;
}

/**
 * Charge par contributeur, la plus lourde d'abord.
 *
 * Une carte a deux assignes compte pour CHACUN : c'est une charge, pas une
 * repartition — la somme des lignes depasse donc volontairement le nombre de
 * cartes. Les membres sans aucune carte figurent quand meme dans la liste :
 * « personne ne lui a rien confie » est l'information la plus utile du tableau.
 */
export function contributorLoad(
  snapshot: BoardSnapshot,
  now: number = nowTimestamp(),
): ContributorLoadEntry[] {
  const entries = new Map<string, ContributorLoadEntry>();
  const zone = dateZoneFor(snapshot.capabilities.source);
  const memberOf = (userId: string) =>
    snapshot.members.find((member) => member.userId === userId) ?? null;

  for (const member of snapshot.members) {
    entries.set(member.userId, { userId: member.userId, member, total: 0, done: 0, overdue: 0 });
  }

  for (const card of snapshot.cards) {
    for (const userId of card.assignees) {
      let entry = entries.get(userId);
      if (!entry) {
        entry = { userId, member: memberOf(userId), total: 0, done: 0, overdue: 0 };
        entries.set(userId, entry);
      }
      entry.total += 1;
      if (isCardDone(card)) entry.done += 1;
      else if (isCardOverdue(card, now, zone)) entry.overdue += 1;
    }
  }

  return [...entries.values()].sort(
    (a, b) =>
      b.total - a.total ||
      b.overdue - a.overdue ||
      // Depart d'egalite STABLE : sans lui, deux contributeurs a charge egale
      // permuteraient d'un rendu a l'autre sous les yeux de l'utilisateur.
      (a.member?.profile?.name ?? a.userId).localeCompare(b.member?.profile?.name ?? b.userId),
  );
}

export interface BoardStats {
  progress: BoardProgress;
  overdue: Card[];
  dueThisWeek: Card[];
  unassigned: Card[];
  byColumn: ColumnBreakdownEntry[];
  byStatus: StatusBreakdownEntry[];
  byContributor: ContributorLoadEntry[];
}

/**
 * Toute la synthese en UN passage, pour que la vue d'ensemble n'appelle qu'une
 * fonction et n'ait pas a memoiser sept resultats separement.
 */
export function boardStats(snapshot: BoardSnapshot, now: number = nowTimestamp()): BoardStats {
  return {
    progress: boardProgress(snapshot),
    overdue: overdueCards(snapshot, now),
    dueThisWeek: dueThisWeekCards(snapshot, now),
    unassigned: unassignedCards(snapshot),
    byColumn: columnBreakdown(snapshot),
    byStatus: statusBreakdown(snapshot),
    byContributor: contributorLoad(snapshot, now),
  };
}
