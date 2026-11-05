/**
 * Filtrage et recherche d'un instantane de tableau — PUR et teste.
 *
 * Un seul endroit decide « cette carte est-elle retenue ? » : la recherche et
 * les popovers de la barre de filtres (DESIGN §6.2), le Kanban, la Liste, la
 * Table, la Chronologie et la vue Jalons s'y branchent. Deux implementations donneraient deux resultats pour le meme
 * critere, et c'est exactement le genre d'ecart qu'un utilisateur lit comme un
 * bug de comptage.
 *
 * Les cinq filtres de la maquette (Assignes, Priorite, Etiquettes, Echeance,
 * Statut) et le filtre par jalon d'un board-lien s'expriment tous ici ;
 * `boardFilterOptions` fournit leurs choix et leurs compteurs, pour que chaque
 * popover n'ait qu'a les afficher.
 *
 * Aucune horloge implicite : `now` est un parametre (defaut `nowTimestamp()`),
 * sans quoi un test du critere « en retard » dependrait du jour ou il tourne.
 */
import { daysUntil, nowTimestamp, type DateZone } from '@/modules/kanban/lib/dates';
import { DUE_THIS_WEEK_DAYS, isCardDone, isCardOverdue } from '@/modules/kanban/lib/boardStats';
import { cardStatusesFor, dateZoneFor } from '@/modules/kanban/lib/boardSource';
import { PRIORITY_FILTER_VALUES, priorityFilterValue, type PriorityFilterValue } from '@/modules/kanban/lib/priority';
import type { BoardLabel, BoardSnapshot, Card, CardStatus, Member, Milestone } from '@/modules/kanban/types';

/**
 * Fenetre d'echeance du filtre « Echeance ».
 *  - `overdue` : echeance passee, carte non close (RG-25) ;
 *  - `today`   : echeance aujourd'hui, carte non close ;
 *  - `week`    : echeance dans les sept jours a venir, aujourd'hui compris,
 *                carte non close — la meme fenetre que le cartouche « cette
 *                semaine » de la vue d'ensemble (`DUE_THIS_WEEK_DAYS`) ;
 *  - `none`    : aucune echeance posee.
 * `today` est inclus dans `week` : les fenetres se cumulent en OU, cocher les
 * deux n'est jamais contradictoire.
 *
 * NON fusionne a dessein avec `matchesDueWindow` (`cardForm.ts`, vue « mes
 * cartes ») : la-bas « cette semaine » INCLUT les retards, parce que c'est
 * l'unique choix offert a qui prepare sa semaine ; ici « en retard » est un
 * choix a part entiere, et le recompter dans « cette semaine » doublerait les
 * cartes en retard dans les deux compteurs du popover.
 */
export type DueWindowFilter = 'overdue' | 'today' | 'week' | 'none';

export const DUE_WINDOW_FILTERS: readonly DueWindowFilter[] = ['overdue', 'today', 'week', 'none'];

/**
 * Valeur du critere « sans jalon ». Une sentinelle qu'un `milestoneId` de
 * Kanban gestion (17 caracteres alphanumeriques) ne peut pas valoir.
 */
export const NO_MILESTONE_FILTER = '__none__';

/**
 * Critere de filtrage. Chaque champ absent ou vide = « ne filtre pas ».
 *
 * Les listes sont des OU internes (statut A ou B) et des ET entre elles
 * (statut A ET priorite haute) : c'est la convention que tout le monde attend
 * d'un panneau de filtres, et la seule qui se decrive en une phrase.
 *
 * Le type doit rester SERIALISABLE : il sert aussi de dimension d'etat d'URL
 * et de cle de memoisation.
 */
export interface BoardFilterCriteria {
  /** Recherche libre : titre, description, nom d'etiquette, tags. */
  text?: string;
  /** Identifiants d'assignes ; une carte suffit a en porter un pour passer. */
  assignees?: string[];
  /** Ne garder que les cartes que personne n'a prises. */
  unassigned?: boolean;
  /** Priorites, `none` = cartes sans priorite (cas courant d'un board-lien). */
  priorities?: PriorityFilterValue[];
  statuses?: CardStatus[];
  labelIds?: string[];
  columnIds?: string[];
  /** Ne garder que les cartes en retard (echeance passee, carte non close). */
  overdue?: boolean;
  /** Ne garder que les cartes non closes. */
  openOnly?: boolean;
  /** Fenetres d'echeance, en OU. */
  dueWindows?: DueWindowFilter[];
  /** Jalons (`milestoneId`), `NO_MILESTONE_FILTER` = cartes sans jalon. */
  milestoneIds?: string[];
}

export const EMPTY_FILTER: BoardFilterCriteria = {};

/**
 * Minuscule + accents retires : « Reunion » doit trouver « Réunion ».
 *
 * NFD separe la lettre de son diacritique, qu'on supprime ensuite ; sans cette
 * decomposition, `é` reste un point de code unique et aucune comparaison
 * simple ne le rapproche de `e`.
 */
export function normalizeSearchText(value: string): string {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase();
}

function hasItems(list: readonly unknown[] | undefined): boolean {
  return Array.isArray(list) && list.length > 0;
}

/** `true` des qu'au moins un critere restreint reellement le resultat. */
export function isFilterActive(criteria: BoardFilterCriteria): boolean {
  return countActiveFilters(criteria) > 0;
}

/**
 * Nombre de criteres actifs — c'est le N de « Retirer les N filtres ».
 *
 * La recherche libre n'y est PAS comptee : elle a son propre champ visible,
 * et son propre bouton d'effacement, en tete de la barre de filtres ; la
 * compter ferait afficher « Retirer 1 filtre » a quelqu'un qui n'a ouvert
 * aucun popover.
 */
export function countActiveFilters(criteria: BoardFilterCriteria): number {
  let count = 0;
  if (hasItems(criteria.assignees)) count += 1;
  if (criteria.unassigned === true) count += 1;
  if (hasItems(criteria.priorities)) count += 1;
  if (hasItems(criteria.statuses)) count += 1;
  if (hasItems(criteria.labelIds)) count += 1;
  if (hasItems(criteria.columnIds)) count += 1;
  if (criteria.overdue === true) count += 1;
  if (criteria.openOnly === true) count += 1;
  if (hasItems(criteria.dueWindows)) count += 1;
  if (hasItems(criteria.milestoneIds)) count += 1;
  return count;
}

/**
 * La carte tombe-t-elle dans cette fenetre d'echeance ?
 *
 * Comptee en jours CIVILS (`daysUntil`) dans le fuseau du tableau
 * (`dateZoneFor`) : une echeance a 23 h ce soir est « aujourd'hui », pas
 * « dans 0,9 jour ». Le retard est decide par `isCardOverdue`, comme dans la
 * vue d'ensemble : une carte close n'y entre jamais, `completedAt` nul compris.
 */
export function matchesDueWindowFilter(
  card: Pick<Card, 'dueDate' | 'completedAt' | 'status'>,
  window: DueWindowFilter,
  now: number = nowTimestamp(),
  zone: DateZone = 'utc',
): boolean {
  if (window === 'none') return card.dueDate === null;
  if (window === 'overdue') return isCardOverdue(card, now, zone);
  // Une carte close n'est plus « a rendre » : ni aujourd'hui, ni cette semaine.
  if (card.dueDate === null || isCardDone(card)) return false;
  const days = daysUntil(card.dueDate, now, zone);
  if (window === 'today') return days === 0;
  return days >= 0 && days < DUE_THIS_WEEK_DAYS;
}

/** Valeur de filtre du jalon d'une carte : son `milestoneId` ou la sentinelle. */
export function milestoneFilterValue(card: Pick<Card, 'milestone'>): string {
  return card.milestone?.milestoneId ?? NO_MILESTONE_FILTER;
}

/**
 * Texte indexe d'une carte : son titre, sa description, le NOM de ses
 * etiquettes (l'utilisateur cherche « logistique », pas `lbl_logistique`) et
 * ses tags — indexes directement, pour qu'un tag tout juste saisi se trouve
 * meme avant que son etiquette n'existe dans l'instantane.
 *
 * Les libelles de CHECKLIST n'y sont pas, a dessein : sur un board-lien,
 * `board/get` ne sert pas la checklist d'une carte au-dela de son budget
 * (`checklistTruncated`, §11.9 E29). Les indexer ferait trouver une carte et
 * pas sa voisine selon sa place dans ce budget ; hors checklist, une carte
 * tronquee se cherche et se filtre exactement comme les autres.
 *
 * Memoise par OBJET carte (#52) : normaliser le titre et la description de
 * mille actions a chaque frappe coutait ~15 % du filtrage a CPU ×4. Les cartes
 * de l'instantane sont immuables — le cache React Query garde la meme
 * reference tant qu'une carte ne change pas — et une carte modifiee est un
 * nouvel objet. Les noms d'etiquettes entrent dans le texte : l'entree n'est
 * reprise que pour la MEME liste d'etiquettes du tableau (meme reference tant
 * qu'elle ne change pas). `WeakMap` : une carte disparue libere son entree.
 */
const searchTextCache = new WeakMap<Card, { labels: readonly BoardLabel[]; text: string }>();

function searchableText(card: Card, labels: readonly BoardLabel[], labelNames: Map<string, string>): string {
  const cached = searchTextCache.get(card);
  if (cached !== undefined && cached.labels === labels) return cached.text;
  const labelText = card.labelIds.map((id) => labelNames.get(id) ?? '').join(' ');
  const tags = (card.tags ?? []).join(' ');
  const text = normalizeSearchText(`${card.title} ${card.description} ${labelText} ${tags}`);
  searchTextCache.set(card, { labels, text });
  return text;
}

/**
 * Cartes retenues, DANS L'ORDRE DU TABLEAU : colonne par rang, puis carte par
 * rang, `_id` en depart d'egalite. Toutes les vues partagent ainsi le meme
 * ordre, et une carte ne saute pas de place quand on coche un filtre.
 */
export function filterCards(
  snapshot: BoardSnapshot,
  criteria: BoardFilterCriteria = EMPTY_FILTER,
  now: number = nowTimestamp(),
): Card[] {
  const labelNames = new Map(snapshot.board.labels.map((label) => [label.id, label.name]));
  const columnOrder = new Map(
    [...snapshot.columns]
      .sort((a, b) => a.rank - b.rank || (a._id < b._id ? -1 : a._id > b._id ? 1 : 0))
      .map((column, index) => [column._id, index]),
  );

  const zone = dateZoneFor(snapshot.capabilities.source);
  const needle = normalizeSearchText((criteria.text ?? '').trim());
  const assignees = criteria.assignees ?? [];
  const priorities = criteria.priorities ?? [];
  const statuses = criteria.statuses ?? [];
  const labelIds = criteria.labelIds ?? [];
  const columnIds = criteria.columnIds ?? [];
  const dueWindows = criteria.dueWindows ?? [];
  const milestoneIds = criteria.milestoneIds ?? [];

  const kept = snapshot.cards.filter((card) => {
    if (needle !== '' && !searchableText(card, snapshot.board.labels, labelNames).includes(needle)) return false;
    if (columnIds.length > 0 && !columnIds.includes(card.columnId)) return false;
    if (priorities.length > 0 && !priorities.includes(priorityFilterValue(card.priority))) return false;
    if (statuses.length > 0 && !statuses.includes(card.status)) return false;
    if (labelIds.length > 0 && !card.labelIds.some((id) => labelIds.includes(id))) return false;
    // « Non assignees » et « assignee a X » se cumulent en OU : cocher les deux
    // demande « les cartes de X, plus celles que personne n'a prises ».
    if (assignees.length > 0 || criteria.unassigned === true) {
      const byAssignee = assignees.some((userId) => card.assignees.includes(userId));
      const byVacancy = criteria.unassigned === true && card.assignees.length === 0;
      if (!byAssignee && !byVacancy) return false;
    }
    if (criteria.overdue === true && !isCardOverdue(card, now, zone)) return false;
    if (criteria.openOnly === true && isCardDone(card)) return false;
    if (dueWindows.length > 0 && !dueWindows.some((window) => matchesDueWindowFilter(card, window, now, zone))) {
      return false;
    }
    if (milestoneIds.length > 0 && !milestoneIds.includes(milestoneFilterValue(card))) return false;
    return true;
  });

  return kept.sort(
    (a, b) =>
      (columnOrder.get(a.columnId) ?? Number.MAX_SAFE_INTEGER) -
        (columnOrder.get(b.columnId) ?? Number.MAX_SAFE_INTEGER) ||
      a.rank - b.rank ||
      (a._id < b._id ? -1 : a._id > b._id ? 1 : 0),
  );
}

/**
 * Meme filtre, rendu colonne par colonne — c'est la forme que consomment le
 * Kanban et la vue liste, qui doivent afficher une colonne VIDE plutot que de
 * la faire disparaitre quand aucun de ses cartes ne passe le filtre.
 */
export function filterCardsByColumn(
  snapshot: BoardSnapshot,
  criteria: BoardFilterCriteria = EMPTY_FILTER,
  now: number = nowTimestamp(),
): Map<string, Card[]> {
  const grouped = new Map<string, Card[]>();
  for (const column of snapshot.columns) grouped.set(column._id, []);
  for (const card of filterCards(snapshot, criteria, now)) {
    const bucket = grouped.get(card.columnId);
    if (bucket) bucket.push(card);
    // Carte orpheline (colonne supprimee entre deux deltas) : elle est
    // volontairement ecartee ici, aucune piste ne peut l'accueillir.
  }
  return grouped;
}

/* -------------------------------------------------------------------------- */
/*  Choix des popovers de filtres                                             */
/* -------------------------------------------------------------------------- */

export interface FilterOption<T extends string> {
  value: T;
  /** Cartes du tableau qui portent cette valeur — sur TOUT le tableau, pas sur le resultat filtre. */
  count: number;
}

export interface AssigneeFilterOption {
  userId: string;
  /** `null` : assigne qui n'est plus membre (carte d'un compte retire). */
  member: Member | null;
  count: number;
}

export interface LabelFilterOption {
  label: BoardLabel;
  count: number;
}

export interface MilestoneFilterOption {
  /** `milestoneId`, ou `NO_MILESTONE_FILTER`. */
  value: string;
  /** `null` pour « sans jalon ». */
  milestone: Milestone | null;
  count: number;
}

export interface BoardFilterOptions {
  /** Membres d'abord (dans leur ordre), puis les assignes inconnus. */
  assignees: AssigneeFilterOption[];
  unassignedCount: number;
  priorities: FilterOption<PriorityFilterValue>[];
  labels: LabelFilterOption[];
  statuses: FilterOption<CardStatus>[];
  dueWindows: FilterOption<DueWindowFilter>[];
  /** Vide sur un board `kanban` (pas de jalons) ; ouverts puis fermes sinon. */
  milestones: MilestoneFilterOption[];
}

/**
 * Choix proposes par chaque popover, avec leur compteur.
 *
 * Compteurs calcules sur TOUT le tableau, comme les facettes d'une recherche :
 * les calculer sur le resultat filtre ferait tomber a zero les choix d'un
 * popover des qu'on coche dans un autre, et l'on ne pourrait plus elargir.
 *
 * Deux choix dependent de la source : « sans priorite » n'est propose que s'il
 * a un sens (board-lien, ou carte sans priorite deja presente), et les statuts
 * d'un board-lien se limitent a ceux que sa colonne peut deriver.
 */
export function boardFilterOptions(
  snapshot: BoardSnapshot,
  now: number = nowTimestamp(),
): BoardFilterOptions {
  const { cards } = snapshot;
  const source = snapshot.capabilities.source;
  const zone = dateZoneFor(source);

  const assigneeCounts = new Map<string, number>();
  let unassignedCount = 0;
  for (const card of cards) {
    if (card.assignees.length === 0) unassignedCount += 1;
    for (const userId of card.assignees) {
      assigneeCounts.set(userId, (assigneeCounts.get(userId) ?? 0) + 1);
    }
  }
  const memberIds = new Set(snapshot.members.map((member) => member.userId));
  const assignees: AssigneeFilterOption[] = [
    ...snapshot.members.map((member) => ({
      userId: member.userId,
      member,
      count: assigneeCounts.get(member.userId) ?? 0,
    })),
    ...[...assigneeCounts.keys()]
      .filter((userId) => !memberIds.has(userId))
      .map((userId) => ({ userId, member: null, count: assigneeCounts.get(userId) ?? 0 })),
  ];

  const countBy = <T extends string>(values: readonly T[], read: (card: Card) => T): FilterOption<T>[] =>
    values.map((value) => ({ value, count: cards.filter((card) => read(card) === value).length }));

  const offersNoPriority = source === 'communecter' || cards.some((card) => card.priority === null);
  const priorities = countBy(
    PRIORITY_FILTER_VALUES.filter((value) => value !== 'none' || offersNoPriority),
    (card) => priorityFilterValue(card.priority),
  );

  const labels = snapshot.board.labels.map((label) => ({
    label,
    count: cards.filter((card) => card.labelIds.includes(label.id)).length,
  }));

  const statuses = countBy(cardStatusesFor(source), (card) => card.status);

  const dueWindows = DUE_WINDOW_FILTERS.map((value) => ({
    value,
    count: cards.filter((card) => matchesDueWindowFilter(card, value, now, zone)).length,
  }));

  const milestones: MilestoneFilterOption[] =
    source === 'communecter'
      ? [
          ...[...snapshot.milestones]
            .sort((a, b) => (a.status === b.status ? 0 : a.status === 'open' ? -1 : 1))
            .map((milestone) => ({
              value: milestone.milestoneId,
              milestone,
              count: cards.filter((card) => card.milestone?.milestoneId === milestone.milestoneId).length,
            })),
          {
            value: NO_MILESTONE_FILTER,
            milestone: null,
            count: cards.filter((card) => !card.milestone).length,
          },
        ]
      : [];

  return { assignees, unassignedCount, priorities, labels, statuses, dueWindows, milestones };
}
