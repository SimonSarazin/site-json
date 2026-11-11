/**
 * Helpers PURS partagés par les vues du tableau des actions. Repris de co-kanban
 * (`pages/board/viewHelpers.ts`), tests compris.
 *
 * Aucun accès au réseau, au cache ni à l'horloge implicite : `now` est toujours un paramètre.
 * C'est ce qui donne EXACTEMENT le même ordre dans la liste, la table et la chronologie, puisque
 * toutes appellent le même comparateur.
 */
import { BOARD_SORT_KEYS, type BoardGroupBy, type BoardSortKey } from '@/modules/kanban/components/board/boardSearch';
import { isCardDone } from '@/modules/kanban/lib/boardStats';
import { civilDayIndex, SECONDS_PER_DAY, type DateZone } from '@/modules/kanban/lib/dates';
import { PRIORITY_ORDER, priorityWeight } from '@/modules/kanban/lib/priority';
import { CARD_STATUSES, type Card, type CardStatus, type Priority } from '@/modules/kanban/types';

/* -------------------------------------------------------------------------- */
/*  Axe des semaines (chronologie)                                            */
/* -------------------------------------------------------------------------- */

export const SECONDS_PER_WEEK = 7 * SECONDS_PER_DAY;

/**
 * Lundi de la semaine contenant `timestamp`, au jour CIVIL de `zone`, exprimé en minuit UTC : la
 * clé de colonne de la chronologie, qui se formate ensuite en UTC sans décalage.
 *
 * Sur un tableau relié, la zone est celle du navigateur : les échéances sont des instants saisis
 * en heure locale par Kanban gestion (lues en UTC, celles du lundi à minuit à La Réunion
 * tombaient dans la semaine précédente). Le 1er janvier 1970 était un JEUDI, d'où le décalage de
 * 3 jours pour ramener l'origine de la numérotation sur un lundi.
 */
export function startOfWeek(timestamp: number, zone: DateZone = 'utc'): number {
  const day = civilDayIndex(timestamp, zone);
  const weekday = (day + 3) % 7;
  return (day - weekday) * SECONDS_PER_DAY;
}

/** Au-delà de ce trou, l'axe saute au lieu de dérouler des semaines vides. */
export const MAX_GAP_FILL_WEEKS = 3;

export interface TimelineWeek {
  /** Lundi, jour civil exprimé en minuit UTC (cf. `startOfWeek`). */
  start: number;
  /** `true` quand des semaines ont été sautées juste avant celle-ci. */
  gapBefore: boolean;
}

/**
 * Axe des semaines de la chronologie.
 *
 * L'axe ne déroule PAS toutes les semaines entre la première et la dernière échéance : une carte
 * datée de 2030 sur un tableau qui vit en 2026 générerait deux cents colonnes vides. On garde les
 * semaines qui portent quelque chose (plus celle d'aujourd'hui), en comblant les trous courts
 * pour que l'axe se lise en continu, et en signalant les sauts (`gapBefore`) au lieu de les taire.
 *
 * @param now instant courant en secondes ; `0` = pas encore hydraté, la semaine courante n'est
 * alors pas ajoutée (le HTML serveur et le premier rendu client restent identiques).
 */
export function buildWeekAxis(dueDates: readonly number[], now: number, zone: DateZone = 'utc'): TimelineWeek[] {
  const starts = new Set<number>();
  for (const due of dueDates) starts.add(startOfWeek(due, zone));
  if (now > 0) starts.add(startOfWeek(now, zone));
  if (starts.size === 0) return [];

  const sorted = [...starts].sort((a, b) => a - b);
  const axis: TimelineWeek[] = [{ start: sorted[0], gapBefore: false }];

  for (let index = 1; index < sorted.length; index += 1) {
    const previous = sorted[index - 1];
    const current = sorted[index];
    const missing = (current - previous) / SECONDS_PER_WEEK - 1;
    if (missing > 0 && missing <= MAX_GAP_FILL_WEEKS) {
      for (let step = 1; step <= missing; step += 1) {
        axis.push({ start: previous + step * SECONDS_PER_WEEK, gapBefore: false });
      }
      axis.push({ start: current, gapBefore: false });
    } else {
      axis.push({ start: current, gapBefore: missing > 0 });
    }
  }

  return axis;
}

/* -------------------------------------------------------------------------- */
/*  Tri de la table                                                           */
/* -------------------------------------------------------------------------- */

/** Colonnes triables de la table. Sans « Liens » : une action Communecter n'en porte pas. */
export type TableSortKey = 'title' | 'status' | 'column' | 'assignees' | 'dueDate' | 'priority' | 'checklist' | 'comments';

export type SortDirection = 'asc' | 'desc';

export interface TableSortState {
  key: TableSortKey;
  direction: SortDirection;
}

export interface CardSortContext {
  /** Rang d'affichage de chaque colonne (`columnBreakdown` fait foi). */
  columnOrder: ReadonlyMap<string, number>;
  /** Nom affichable de chaque assigné, pour trier la colonne « Assignés ». */
  memberNames: ReadonlyMap<string, string>;
}

/**
 * Ordre d'avancement d'un statut : `not_started` d'abord, `complete` en dernier. Lu dans
 * `CARD_STATUSES`, qui EST déjà cet ordre : une table de poids recopiée finirait par la contredire.
 */
function statusWeight(status: CardStatus): number {
  return CARD_STATUSES.indexOf(status);
}

function firstAssigneeName(card: Card, memberNames: ReadonlyMap<string, string>): string {
  const names = card.assignees.map((userId) => memberNames.get(userId) ?? '');
  // Les cartes non assignées passent DERRIÈRE en tri croissant : « qui fait quoi » se lit mieux
  // quand la file d'attente est en fin de liste.
  return names.sort((a, b) => a.localeCompare(b))[0] ?? '￿';
}

/** Part faite de la checklist, `-1` quand il n'y en a pas (elles se regroupent). */
function checklistRatio(card: Card): number {
  if (card.checklistTotal <= 0) return -1;
  return card.checklistDone / card.checklistTotal;
}

/**
 * Comparateur d'une colonne de la table, en ordre CROISSANT : du plus tôt au plus tard pour une
 * échéance, de la priorité la plus basse à la plus haute, du moins au plus avancé pour un statut.
 * L'inversion est appliquée par l'appelant, jamais ici.
 */
export function compareCardsBy(left: Card, right: Card, key: TableSortKey, context: CardSortContext): number {
  switch (key) {
    case 'title':
      return left.title.localeCompare(right.title);
    case 'status':
      return statusWeight(left.status) - statusWeight(right.status);
    case 'column':
      return (context.columnOrder.get(left.columnId) ?? Number.MAX_SAFE_INTEGER) - (context.columnOrder.get(right.columnId) ?? Number.MAX_SAFE_INTEGER);
    case 'assignees':
      return firstAssigneeName(left, context.memberNames).localeCompare(firstAssigneeName(right, context.memberNames));
    case 'dueDate':
      // Sans échéance = « pas de date » et non « date zéro » : ces cartes restent en fin de tri
      // croissant.
      return (left.dueDate ?? Number.MAX_SAFE_INTEGER) - (right.dueDate ?? Number.MAX_SAFE_INTEGER);
    case 'priority':
      return priorityWeight(left.priority) - priorityWeight(right.priority);
    case 'checklist':
      return checklistRatio(left) - checklistRatio(right);
    case 'comments':
      return left.commentCount - right.commentCount;
  }
}

/**
 * Trie des cartes selon l'état de tri courant. Le `_id` sert de départage FINAL : sans lui, deux
 * cartes de même priorité changeraient de place d'un rendu à l'autre, l'ordre d'entrée venant
 * d'un filtre qui peut changer.
 */
export function sortCards(cards: readonly Card[], sort: TableSortState, context: CardSortContext): Card[] {
  const factor = sort.direction === 'asc' ? 1 : -1;
  return [...cards].sort((left, right) => {
    const compared = compareCardsBy(left, right, sort.key, context) * factor;
    if (compared !== 0) return compared;
    return left._id < right._id ? -1 : left._id > right._id ? 1 : 0;
  });
}

/* -------------------------------------------------------------------------- */
/*  Divers                                                                    */
/* -------------------------------------------------------------------------- */

/** Ton de pastille d'un statut de carte (encre sur teinte, libellé toujours écrit). */
export const STATUS_TONE: Readonly<Record<CardStatus, 'neutral' | 'warn' | 'info' | 'success'>> = {
  not_started: 'neutral',
  in_research: 'warn',
  on_track: 'info',
  complete: 'success',
};

/** Cartes terminées d'une liste : le même verdict que partout ailleurs. */
export function countDone(cards: readonly Card[]): number {
  return cards.filter(isCardDone).length;
}

/* -------------------------------------------------------------------------- */
/*  Regroupement et ordre de la vue Liste                                     */
/* -------------------------------------------------------------------------- */

/**
 * Un groupe de la vue Liste. Le LIBELLÉ est laissé à la vue : elle seule traduit.
 *
 * UNION DISCRIMINÉE plutôt que `{ kind, value: string }` : la vue rend une pastille de statut pour
 * un groupe de statuts, un portrait pour un groupe d'assignés, sans re-typer la valeur à la main.
 */
export type CardGroup =
  | { id: string; kind: 'column'; columnId: string; cards: Card[] }
  | { id: string; kind: 'status'; status: CardStatus; cards: Card[] }
  /** `priority` à `null` = les cartes sans priorité (cas courant d'une action Communecter). */
  | { id: string; kind: 'priority'; priority: Priority | null; cards: Card[] }
  /** `userId` à `null` = la file des cartes que personne n'a prises. */
  | { id: string; kind: 'assignee'; userId: string | null; cards: Card[] }
  | { id: string; kind: 'none'; cards: Card[] };

export interface GroupContext {
  columnIds: readonly string[];
  memberIds: readonly string[];
  /**
   * Statuts possibles sur ce tableau (`cardStatusesFor` de la source). Une action Communecter n'en
   * porte que trois : un groupe « En recherche » toujours vide n'y dirait rien.
   */
  statuses: readonly CardStatus[];
}

/**
 * Regroupe les cartes selon l'axe choisi dans « Grouper ». Deux partis pris :
 *
 *  - un groupe VIDE reste affiché (colonne, statut ou membre sans carte) : « rien n'est en
 *    cours » ou « personne ne lui a rien confié » ne se lit pas sur une liste dont les groupes
 *    disparaissent ;
 *  - par assigné, une carte à deux personnes apparaît DANS LES DEUX groupes : c'est une charge,
 *    pas une répartition, exactement comme `contributorLoad`.
 */
export function groupCards(cards: readonly Card[], groupBy: BoardGroupBy, context: GroupContext): CardGroup[] {
  if (groupBy === 'none') {
    return [{ id: 'all', kind: 'none', cards: [...cards] }];
  }

  if (groupBy === 'status') {
    return context.statuses.map((status) => ({
      id: `status-${status}`,
      kind: 'status' as const,
      status,
      cards: cards.filter((card) => card.status === status),
    }));
  }

  if (groupBy === 'priority') {
    const groups: CardGroup[] = PRIORITY_ORDER.map((priority) => ({
      id: `priority-${priority}`,
      kind: 'priority' as const,
      priority,
      cards: cards.filter((card) => card.priority === priority),
    }));
    // « Sans priorité » en DERNIER, et seulement quand une carte est dans ce cas.
    const unprioritized = cards.filter((card) => card.priority === null);
    if (unprioritized.length > 0) {
      groups.push({ id: 'priority-none', kind: 'priority', priority: null, cards: unprioritized });
    }
    return groups;
  }

  if (groupBy === 'assignee') {
    const groups: CardGroup[] = context.memberIds.map((userId) => ({
      id: `assignee-${userId}`,
      kind: 'assignee' as const,
      userId,
      cards: cards.filter((card) => card.assignees.includes(userId)),
    }));
    // Les cartes que personne n'a prises en DERNIER : c'est la file d'attente.
    groups.push({ id: 'assignee-none', kind: 'assignee', userId: null, cards: cards.filter((card) => card.assignees.length === 0) });
    return groups;
  }

  return context.columnIds.map((columnId) => ({
    id: `column-${columnId}`,
    kind: 'column' as const,
    columnId,
    cards: cards.filter((card) => card.columnId === columnId),
  }));
}

/** Correspondance entre les clés du « Trier » de la barre et celles de la table. */
const SHELL_SORT_KEYS: Readonly<Record<Exclude<BoardSortKey, 'rank'>, TableSortKey>> = {
  title: 'title',
  dueDate: 'dueDate',
  priority: 'priority',
  status: 'status',
};

/**
 * Ordonne des cartes selon le tri choisi dans « Trier ». `rank` n'est pas un critère comparable :
 * c'est l'ordre du tableau, déjà porté par l'entrée (`filterCards` trie par colonne puis par
 * rang). On se contente de l'inverser quand le tri est descendant.
 */
export function orderCards(cards: readonly Card[], sortKey: BoardSortKey, direction: SortDirection, context: CardSortContext): Card[] {
  if (sortKey === 'rank') return direction === 'asc' ? [...cards] : [...cards].reverse();
  return sortCards(cards, { key: SHELL_SORT_KEYS[sortKey], direction }, context);
}

/*
 * Pont entre le « Trier » de la barre (cinq clés) et le tri de la table (huit colonnes) : le SEUL
 * endroit qui sait les rapprocher. Sans lui, un clic sur l'en-tête « Échéance » et « Trier par
 * échéance » finiraient par vouloir dire deux choses.
 */

/** Tri de table correspondant au tri de la barre. `rank` = ordre du tableau. */
export function tableSortFromShell(key: BoardSortKey, direction: SortDirection): TableSortState {
  return { key: key === 'rank' ? 'column' : SHELL_SORT_KEYS[key], direction };
}

/** Clé de barre correspondante, ou `null` pour une colonne propre à la table. */
export function shellSortKeyFor(key: TableSortKey): BoardSortKey | null {
  if (key === 'column') return 'rank';
  return BOARD_SORT_KEYS.find((shellKey) => shellKey !== 'rank' && SHELL_SORT_KEYS[shellKey] === key) ?? null;
}
