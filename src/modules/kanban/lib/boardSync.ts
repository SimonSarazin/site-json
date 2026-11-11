/**
 * Algebre PURE de l'instantane d'un tableau.
 *
 * Un seul module pour les deux sources de changement, parce qu'elles doivent
 * produire exactement le meme etat :
 *  - les mutations OPTIMISTES locales (`useBoardMutations`), appliquees avant
 *    la reponse du serveur ;
 *  - les activites DISTANTES rapatriees par le polling delta (`useBoardSync`).
 *
 * Tout y est pur et teste : aucune lecture du cache, aucun appel reseau,
 * aucune mutation en place (le cache TanStack Query doit changer d'identite
 * pour que React re-rende).
 *
 * Des regles metier y sont MIROITEES depuis le backend, pour que l'affichage
 * optimiste ne sursaute pas a la reponse :
 *  - `completedAt` suit la colonne de cloture (RG-30) ;
 *  - `cardCount` et `board.counts` sont recalcules a chaque changement ;
 *  - sur un board-lien Communecter (§11) : le rang EST la position canonique
 *    (D16), le statut decoule de la colonne (§11.4) et chaque tag a son
 *    etiquette `tag:<tag>`.
 */
import type { UpdateCardInput } from '@/modules/kanban/api/cards';
import { applyCanonicalRanks } from '@/modules/kanban/lib/canonicalOrder';
import { communecterStatusForColumn } from '@/modules/kanban/lib/boardSource';
import { mergeAssignees, mergeChecklist, mergeTags, type ChecklistIdFactory } from '@/modules/kanban/lib/cardMerge';
import { nowTimestamp } from '@/modules/kanban/lib/dates';
import { milestoneCopy } from '@/modules/kanban/lib/milestones';
import { rankFirst, rankLast, sortByRank } from '@/modules/kanban/lib/rank';
import { tagLabelId, withMissingTagLabels } from '@/modules/kanban/lib/tags';
import {
  isRecord,
  isCard,
  isColumn,
  type Activity,
  type Board,
  type BoardSnapshot,
  type Card,
  type CardLink,
  type CardStatus,
  type Column,
  type Member,
  type Milestone,
  type Priority,
  type RankUpdate,
  type SyncResult,
} from '@/modules/kanban/types';

/* -------------------------------------------------------------------------- */
/*  Fondations                                                                */
/* -------------------------------------------------------------------------- */

function recount(board: Board, columns: Column[], cards: Card[]): { board: Board; columns: Column[] } {
  const doneColumnIds = new Set(columns.filter((column) => column.isDoneColumn).map((column) => column._id));

  const perColumn = new Map<string, number>();
  for (const card of cards) {
    perColumn.set(card.columnId, (perColumn.get(card.columnId) ?? 0) + 1);
  }

  const nextColumns = columns.map((column) => {
    const cardCount = perColumn.get(column._id) ?? 0;
    return column.cardCount === cardCount ? column : { ...column, cardCount };
  });

  const done = cards.filter((card) => doneColumnIds.has(card.columnId)).length;
  const sameCounts =
    board.counts.columns === columns.length && board.counts.cards === cards.length && board.counts.done === done;

  return {
    board: sameCounts ? board : { ...board, counts: { columns: columns.length, cards: cards.length, done } },
    columns: nextColumns,
  };
}

/**
 * Fusion qui IGNORE les cles `undefined`.
 *
 * Un formulaire n'envoie que les champs touches : `{...card, ...patch}` avec
 * `patch.dueDate === undefined` effacerait l'echeance au lieu de la laisser
 * intacte. Le bug est invisible au typage (`Partial<T>` autorise `undefined`).
 * `null`, lui, est une VALEUR (« aucune priorite », « aucun jalon ») et passe.
 */
function mergeDefined<T extends object>(base: T, patch: Partial<T>): T {
  const next = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    Reflect.set(next, key, value);
  }
  return next;
}

interface SnapshotPatch {
  board?: Board;
  columns?: Column[];
  cards?: Card[];
  members?: Member[];
  milestones?: Milestone[];
}

function isCommunecter(snapshot: BoardSnapshot): boolean {
  return snapshot.capabilities.source === 'communecter';
}

/**
 * Etiquettes manquantes d'un board-lien : un tag tout juste saisi doit avoir
 * son etiquette (nom, couleur) avant meme le prochain `board/get`.
 */
function withTagLabels(board: Board, cards: readonly Card[]): Board {
  const labels = withMissingTagLabels(board.labels, cards);
  return labels === board.labels ? board : { ...board, labels: [...labels] };
}

/** Recompose un instantane : tri canonique + compteurs recalcules. */
function commit(snapshot: BoardSnapshot, patch: SnapshotPatch): BoardSnapshot {
  const communecter = isCommunecter(snapshot);
  const columns = sortByRank(patch.columns ?? snapshot.columns);
  const rawCards = patch.cards ?? snapshot.cards;
  // D16 : sur un board-lien, le rang n'est pas stocke, il DECOULE de la priorite
  // et de la date de creation (rang absolu, §11.9). Le recalculer a chaque
  // ecriture range une carte creee ou repriorisee exactement la ou le serveur
  // va la confirmer.
  const cards = sortByRank(communecter ? applyCanonicalRanks(rawCards) : rawCards);
  const baseBoard = patch.board ?? snapshot.board;
  const counted = recount(communecter ? withTagLabels(baseBoard, cards) : baseBoard, columns, cards);
  return {
    board: counted.board,
    columns: counted.columns,
    cards,
    members: patch.members ?? snapshot.members,
    capabilities: snapshot.capabilities,
    milestones: patch.milestones ?? snapshot.milestones,
    // Une ecriture locale ne change pas la langue des libelles recus.
    ...(snapshot.servedLanguage === undefined ? {} : { servedLanguage: snapshot.servedLanguage }),
  };
}

/**
 * Remplace l'element de meme cle, ou l'ajoute a la fin. Une seule
 * implementation pour les cartes, les colonnes et les jalons (dont la cle
 * s'appelle `milestoneId`), et pour la liste dediee des jalons.
 */
export function upsertById<T>(items: readonly T[], item: T, keyOf: (entry: T) => string): T[] {
  const key = keyOf(item);
  return items.some((entry) => keyOf(entry) === key)
    ? items.map((entry) => (keyOf(entry) === key ? item : entry))
    : [...items, item];
}

const byEntityId = (entry: { _id: string }): string => entry._id;

/** Cle d'un jalon : `milestoneId` (17 caracteres facon Meteor), jamais un index. */
export const milestoneKey = (milestone: Milestone): string => milestone.milestoneId;

/** Un tableau archive ou modifie a toujours un `rev` plus haut : on le suit. */
function withRev(snapshot: BoardSnapshot, rev: number): BoardSnapshot {
  if (rev <= snapshot.board.rev) return snapshot;
  return { ...snapshot, board: { ...snapshot.board, rev } };
}

function findColumn(snapshot: BoardSnapshot, columnId: string): Column | undefined {
  return snapshot.columns.find((column) => column._id === columnId);
}

/* -------------------------------------------------------------------------- */
/*  Mutations optimistes                                                      */
/* -------------------------------------------------------------------------- */

export function upsertCard(snapshot: BoardSnapshot, card: Card): BoardSnapshot {
  return commit(snapshot, { cards: upsertById(snapshot.cards, card, byEntityId) });
}

/** Remplace une carte provisoire par celle du serveur (creation optimiste). */
export function replaceCard(snapshot: BoardSnapshot, temporaryId: string, card: Card): BoardSnapshot {
  const cards = snapshot.cards.filter((entry) => entry._id !== temporaryId && entry._id !== card._id);
  return commit(snapshot, { cards: [...cards, card] });
}

export function patchCard(
  snapshot: BoardSnapshot,
  cardId: string,
  patch: Partial<Card>,
  now: number = nowTimestamp(),
): BoardSnapshot {
  const cards = snapshot.cards.map((card) => {
    if (card._id !== cardId) return card;
    const next: Card = { ...mergeDefined(card, patch), updated: now };
    if (patch.checklist) {
      // Les compteurs de checklist sont derives : les laisser diverger ferait
      // clignoter la pastille « 2/3 » a chaque coche.
      next.checklistTotal = patch.checklist.length;
      next.checklistDone = patch.checklist.filter((item) => item.done).length;
    }
    // Meme raison pour les liens : la ligne meta de la carte lit `linkCount`,
    // pas `links.length`. Sans ce recalcul, retirer un lien en laisserait la
    // trace « 2 liens » jusqu'a la reponse du serveur.
    if (patch.links) next.linkCount = patch.links.length;
    return next;
  });
  return commit(snapshot, { cards });
}

/** Champs de `card/update`, sans les identifiants. */
export type CardUpdateFields = Omit<UpdateCardInput, 'boardId' | 'cardId'>;

/**
 * Identifiant d'un point AJOUTE dans l'affichage optimiste : celui du client
 * (`ck_<n>`) tant qu'il est libre, sinon suffixe. Le serveur forge le sien, que
 * la reponse substitue aussitot.
 */
const optimisticChecklistId: ChecklistIdFactory = (item, taken) => {
  const wanted = item.id ?? 'ck_new';
  let id = wanted;
  for (let suffix = 2; taken.has(id); suffix += 1) id = `${wanted}-${suffix}`;
  return id;
};

/**
 * Traduit les champs envoyes a `card/update` en correctif de CARTE.
 *
 * Deux champs ne s'ecrivent pas tels quels sur la carte (§11.4) : `tags`
 * entraine `labelIds` (`tag:<tag>`), et `milestoneId` devient la COPIE du
 * jalon que le serveur va poser. Une liste accompagnee de sa BASE (board-lien)
 * est FUSIONNEE avec la carte actuelle du cache, exactement comme le serveur va
 * le faire (`lib/cardMerge`) : une sous-tache que le polling vient d'apporter
 * ne disparait pas un instant de l'ecran. Les bases elles-memes ne sont pas des
 * champs de carte : elles ne passent jamais dans le correctif.
 *
 * Carte TRONQUEE de l'instantane (`checklistTruncated`, budget de `board/get`) :
 * AUCUN optimiste pour la checklist. Sa liste vide n'est pas la valeur
 * actuelle — fusionner contre elle ferait disparaitre de l'ecran chaque point
 * que la fiche n'a pas touche, et recompterait la pastille « 3/12 » sur la
 * seule liste envoyee. Le cache garde liste et compteurs jusqu'a la reponse du
 * serveur, qui porte la carte complete.
 *
 * @param current carte du cache avant l'ecriture ; sans elle, la liste
 *   envoyee est prise telle quelle (la reponse du serveur tranchera).
 */
export function cardPatchFromUpdate(
  snapshot: BoardSnapshot,
  fields: CardUpdateFields,
  current?: Card,
): Partial<Card> {
  const { milestoneId, tags, checklist, checklistBase, assigneesBase, tagsBase, ...rest } = fields;
  const patch: Partial<Card> = { ...rest };
  if (checklist !== undefined && current?.checklistTruncated !== true) {
    patch.checklist =
      checklistBase !== undefined && current
        ? mergeChecklist(checklistBase, checklist, current.checklist, optimisticChecklistId)
        : checklist;
  }
  if (rest.assignees !== undefined && assigneesBase !== undefined && current) {
    patch.assignees = mergeAssignees(assigneesBase, rest.assignees, current.assignees);
  }
  if (tags !== undefined) {
    const merged = tagsBase !== undefined && current ? mergeTags(tagsBase, tags, current.tags ?? []) : [...tags];
    patch.tags = merged;
    patch.labelIds = merged.map(tagLabelId);
  }
  const milestone = milestoneCopy(snapshot.milestones, milestoneId);
  if (milestone !== undefined) patch.milestone = milestone;
  return patch;
}

/** Donnees d'une carte a creer, telles que les saisit l'interface. */
export interface CardDraftInput {
  columnId?: string;
  title: string;
  description?: string;
  priority?: Priority | null;
  status?: CardStatus;
  assignees?: string[];
  labelIds?: string[];
  links?: CardLink[];
  dueDate?: number | null;
  position?: 'top' | 'bottom';
  tags?: string[];
  milestoneId?: string | null;
}

export interface OptimisticCardContext {
  temporaryId: string;
  userId: string | null;
  now: number;
}

/**
 * Carte provisoire d'une creation optimiste, a l'image de ce que le serveur
 * va renvoyer — selon la SOURCE du tableau.
 *
 * Board kanban : priorite `medium` par defaut, statut `complete` si la carte
 * nait dans une colonne de cloture (`KanbanCard::statusForColumn()`).
 * Board-lien : sans priorite par defaut (cas majoritaire de Communecter),
 * statut derive de la colonne, montant 1 (defaut de `request/new`), tags et
 * jalon traduits comme a l'ecriture. Le rang, lui, est recalcule par `commit`.
 *
 * `null` quand le tableau n'a aucune colonne : il n'y a nulle part ou poser.
 */
export function buildOptimisticCard(
  snapshot: BoardSnapshot,
  input: CardDraftInput,
  context: OptimisticCardContext,
): Card | null {
  const columnId = input.columnId ?? snapshot.columns[0]?._id;
  if (!columnId) return null;
  const column = findColumn(snapshot, columnId);
  const isDone = column?.isDoneColumn === true;
  const siblings = snapshot.cards.filter((card) => card.columnId === columnId);
  const communecter = isCommunecter(snapshot);
  const { now } = context;

  const card: Card = {
    _id: context.temporaryId,
    boardId: snapshot.board._id,
    columnId,
    // En TETE sans position demandee, comme `card/create` (`POSITION_TOP`) : la
    // carte provisoire tombe deja la ou le serveur va la poser.
    rank: input.position === 'bottom' ? rankLast(siblings) : rankFirst(siblings),
    title: input.title,
    description: input.description ?? '',
    priority: communecter ? (input.priority ?? null) : (input.priority ?? 'medium'),
    assignees: input.assignees ?? [],
    labelIds: input.labelIds ?? [],
    checklist: [],
    checklistDone: 0,
    checklistTotal: 0,
    // Meme arbitrage que `KanbanCard::statusForColumn()` : un statut
    // explicitement demande l'emporte, sinon naitre dans une colonne de
    // cloture fait naitre `complete`.
    status: communecter
      ? communecterStatusForColumn(columnId)
      : (input.status ?? (isDone ? 'complete' : 'not_started')),
    links: communecter ? [] : (input.links ?? []),
    linkCount: communecter ? 0 : (input.links ?? []).length,
    // Une carte nait sans fil de discussion : afficher autre chose ici
    // serait le premier compteur faux de l'interface.
    commentCount: 0,
    dueDate: input.dueDate ?? null,
    completedAt: isDone ? now : null,
    creator: context.userId ?? '',
    created: now,
    updated: now,
  };
  if (!communecter) return card;

  const tags = input.tags ?? [];
  return {
    ...card,
    tags,
    labelIds: tags.map(tagLabelId),
    startDate: null,
    milestone: milestoneCopy(snapshot.milestones, input.milestoneId) ?? null,
    credits: 1,
    timeSpent: 0,
    unseenComments: 0,
    archived: false,
  };
}

export interface CardMoveIntent {
  cardId: string;
  columnId: string;
  rank: number;
}

/**
 * Statut qu'une carte doit porter une fois dans la colonne visee — miroir
 * EXACT de `KanbanCard::statusForColumn()` (board `kanban`).
 *
 * Il n'est pas question de deviner : entrer dans une colonne de cloture force
 * `complete`, en sortir ramene a `on_track` et SEULEMENT si la carte etait
 * close (une carte « en recherche » qui change de colonne ordinaire garde son
 * statut). Sans ce miroir, la pastille haute de la carte afficherait « Non
 * demarre » sur une carte qu'on vient de deposer dans « Terminé », jusqu'a la
 * reponse du serveur.
 */
export function statusForColumn(current: CardStatus, targetIsDone: boolean): CardStatus {
  if (targetIsDone) return 'complete';
  return current === 'complete' ? 'on_track' : current;
}

export function moveCardInSnapshot(
  snapshot: BoardSnapshot,
  intent: CardMoveIntent,
  now: number = nowTimestamp(),
): BoardSnapshot {
  const target = findColumn(snapshot, intent.columnId);
  const targetIsDone = target?.isDoneColumn === true;
  const communecter = isCommunecter(snapshot);
  const cards = snapshot.cards.map((card) => {
    if (card._id !== intent.cardId) return card;
    return {
      ...card,
      columnId: intent.columnId,
      rank: intent.rank,
      // RG-30 : la cloture suit la colonne « terminee », pas l'ordre des
      // colonnes. Une carte deja close qui reste dans la colonne de cloture
      // garde sa date d'origine.
      completedAt: targetIsDone ? (card.completedAt ?? now) : null,
      // Board-lien : le statut DECOULE de la colonne (§11.4) ; board kanban :
      // la regle de cloture du serveur.
      status: communecter
        ? communecterStatusForColumn(intent.columnId)
        : statusForColumn(card.status, targetIsDone),
      updated: now,
    };
  });
  return commit(snapshot, { cards });
}

/**
 * Pose le compteur de commentaires d'une carte (valeur d'AUTORITE du serveur).
 *
 * Volontairement hors de `patchCard` : commenter ne modifie pas la carte, cela
 * modifie son fil. Toucher `updated` ici ferait remonter la carte dans tout tri
 * « recemment modifiees » pour un simple message.
 */
export function setCardCommentCount(
  snapshot: BoardSnapshot,
  cardId: string,
  commentCount: number,
): BoardSnapshot {
  let changed = false;
  const cards = snapshot.cards.map((card) => {
    if (card._id !== cardId) return card;
    // Borne a zero, comme le filtre `{$gt: 0}` du `$inc` cote Mongo : rejouer
    // une suppression ne doit pas faire passer le compteur sous zero.
    const next = Math.max(0, Math.round(commentCount));
    if (next === card.commentCount) return card;
    changed = true;
    return { ...card, commentCount: next };
  });
  // Identite preservee quand rien ne bouge : l'appelant peut balayer TOUS les
  // instantanes en cache sans provoquer de rendu sur ceux qui n'ont pas la carte.
  return changed ? commit(snapshot, { cards }) : snapshot;
}

/**
 * Deplacement RELATIF du compteur (+1 a l'envoi, -1 si l'envoi echoue).
 *
 * Relatif et non absolu parce que l'instantane est ecrit par plusieurs sources
 * (les mutations, le polling delta) : reposer une valeur absolue photographiee
 * avant l'aller-retour ecraserait un commentaire arrive entre-temps.
 */
export function adjustCardCommentCount(
  snapshot: BoardSnapshot,
  cardId: string,
  delta: number,
): BoardSnapshot {
  const card = snapshot.cards.find((entry) => entry._id === cardId);
  if (!card) return snapshot;
  return setCardCommentCount(snapshot, cardId, card.commentCount + delta);
}

/**
 * Remet a zero les commentaires non vus d'une carte.
 *
 * `comment/list` pose `views.<userId>` cote serveur (§11.6) : des que le fil
 * est lu, la pastille « non lus » de la carte doit tomber, sans attendre un
 * rechargement. Identite preservee quand il n'y avait rien a remettre a zero.
 */
export function markCardCommentsSeen(snapshot: BoardSnapshot, cardId: string): BoardSnapshot {
  const card = snapshot.cards.find((entry) => entry._id === cardId);
  if (!card || !card.unseenComments) return snapshot;
  return commit(snapshot, {
    cards: snapshot.cards.map((entry) => (entry._id === cardId ? { ...entry, unseenComments: 0 } : entry)),
  });
}

export function removeCard(snapshot: BoardSnapshot, cardId: string): BoardSnapshot {
  return commit(snapshot, { cards: snapshot.cards.filter((card) => card._id !== cardId) });
}

export function upsertColumn(snapshot: BoardSnapshot, column: Column): BoardSnapshot {
  return commit(snapshot, { columns: upsertById(snapshot.columns, column, byEntityId) });
}

export function patchColumn(
  snapshot: BoardSnapshot,
  columnId: string,
  patch: Partial<Column>,
  now: number = nowTimestamp(),
): BoardSnapshot {
  const columns = snapshot.columns.map((column) =>
    column._id === columnId ? { ...mergeDefined(column, patch), updated: now } : column,
  );

  const becameDone = patch.isDoneColumn;
  const cards =
    becameDone === undefined
      ? snapshot.cards
      : snapshot.cards.map((card) =>
          card.columnId === columnId
            ? {
                ...card,
                completedAt: becameDone ? (card.completedAt ?? now) : null,
                // Meme regle qu'au deplacement : basculer la colonne en
                // « terminee » clot ses cartes, la debasculer les rouvre.
                status: statusForColumn(card.status, becameDone),
                updated: now,
              }
            : card,
        );

  return commit(snapshot, { columns, cards });
}

export function moveColumnInSnapshot(
  snapshot: BoardSnapshot,
  columnId: string,
  rank: number,
  now: number = nowTimestamp(),
): BoardSnapshot {
  return patchColumn(snapshot, columnId, { rank }, now);
}

/**
 * Retire une colonne.
 *
 * `moveToColumnId` reproduit `column/delete` : les cartes sont deplacees, pas
 * supprimees. Sans destination, les cartes de la colonne disparaissent de
 * l'instantane — le backend refuse de son cote de supprimer une colonne non
 * vide sans destination (409 `columnNotEmpty`).
 */
export function removeColumn(
  snapshot: BoardSnapshot,
  columnId: string,
  moveToColumnId?: string,
  now: number = nowTimestamp(),
): BoardSnapshot {
  const columns = snapshot.columns.filter((column) => column._id !== columnId);
  const target = moveToColumnId ? findColumn(snapshot, moveToColumnId) : undefined;

  const moved = snapshot.cards.filter((card) => card.columnId === columnId);
  const kept = snapshot.cards.filter((card) => card.columnId !== columnId);

  if (!target) return commit(snapshot, { columns, cards: kept });

  let rank = kept
    .filter((card) => card.columnId === target._id)
    .reduce((max, card) => Math.max(max, card.rank), 0);

  const relocated = sortByRank(moved).map((card) => {
    rank += 1000;
    return {
      ...card,
      columnId: target._id,
      rank,
      completedAt: target.isDoneColumn ? (card.completedAt ?? now) : null,
      updated: now,
    };
  });

  return commit(snapshot, { columns, cards: [...kept, ...relocated] });
}

export function setMembers(snapshot: BoardSnapshot, members: Member[]): BoardSnapshot {
  const memberIds = members.map((member) => member.userId);
  // RG-12 : un membre retire est desassigne de ses cartes, aucune n'est perdue.
  const knownIds = new Set(memberIds);
  const cards = snapshot.cards.map((card) => {
    const assignees = card.assignees.filter((userId) => knownIds.has(userId));
    return assignees.length === card.assignees.length ? card : { ...card, assignees };
  });

  return commit(snapshot, {
    members,
    cards,
    board: { ...snapshot.board, memberIds },
  });
}

export function patchBoard(snapshot: BoardSnapshot, patch: Partial<Board>): BoardSnapshot {
  return commit(snapshot, { board: mergeDefined(snapshot.board, patch) });
}

/** Remplace la liste des jalons (reponse de `milestone/list`). */
export function setMilestones(snapshot: BoardSnapshot, milestones: readonly Milestone[]): BoardSnapshot {
  return commit(snapshot, { milestones: [...milestones] });
}

/**
 * Pose un jalon cree ou modifie, a sa place s'il existe deja.
 *
 * Les COPIES portees par les cartes ne sont pas reecrites : le serveur ne le
 * fait pas non plus (§11.6), et l'affichage passe par `resolveCardMilestone`,
 * qui lit le nom frais dans cette liste.
 */
export function upsertMilestone(snapshot: BoardSnapshot, milestone: Milestone): BoardSnapshot {
  return commit(snapshot, { milestones: upsertById(snapshot.milestones, milestone, milestoneKey) });
}

/**
 * Applique la renumerotation DECIDEE PAR LE SERVEUR.
 *
 * Elle fait autorite sur le rang optimiste : quand le serveur renumerote, les
 * rangs calcules localement ne veulent plus rien dire.
 */
export function applyRankUpdates(
  snapshot: BoardSnapshot,
  kind: 'cards' | 'columns',
  updates: readonly RankUpdate[],
): BoardSnapshot {
  if (updates.length === 0) return snapshot;
  const ranks = new Map(updates.map((update) => [update.id, update.rank]));

  if (kind === 'cards') {
    const cards = snapshot.cards.map((card) => {
      const rank = ranks.get(card._id);
      return rank === undefined ? card : { ...card, rank };
    });
    return commit(snapshot, { cards });
  }

  const columns = snapshot.columns.map((column) => {
    const rank = ranks.get(column._id);
    return rank === undefined ? column : { ...column, rank };
  });
  return commit(snapshot, { columns });
}

/* -------------------------------------------------------------------------- */
/*  Reducteur d'activites distantes                                           */
/* -------------------------------------------------------------------------- */

function readNumber(payload: Record<string, unknown>, key: string): number | undefined {
  const value = payload[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function readString(payload: Record<string, unknown>, key: string): string | undefined {
  const value = payload[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/** Ce que le rejeu sait de l'instantane, au-dela de la carte elle-meme. */
export interface JournalCardContext {
  /**
   * L'activite est-elle POSTERIEURE a l'instantane (`rev` superieur a celui du
   * tableau avant le rejeu) ? Sinon son effet y est deja : rejouee une seconde
   * fois, ou deja comptee par un `board/get` plus recent qui a calcule les
   * non-lus cote serveur.
   */
  fresh: boolean;
  /** Board-lien : les non-lus y sont suivis (§11.9 E5). */
  tracksUnseen: boolean;
}

/**
 * Carte du JOURNAL, appliquee sur la carte locale.
 *
 * `payload.card` est PARTAGE entre tous les lecteurs du tableau : le serveur
 * n'y met jamais `unseenComments`, propre a chacun (§11.9). La remplacer telle
 * quelle effacerait la pastille « non lus » au moindre deplacement fait par un
 * collegue. La valeur locale est donc CONSERVEE :
 *  - augmentee d'un quand l'activite apporte le commentaire d'une AUTRE
 *    personne (`payload.comment`, `comment/add`) — le sien est vu d'office —
 *    et seulement si l'activite est NOUVELLE pour cet instantane (`fresh`) :
 *    rejouer deux fois la meme ligne ne compte pas deux non-lus. La garde porte
 *    sur la revision et non sur `commentCount` : le +1 optimiste de son propre
 *    message, pose avant le rejeu, masquait celui d'un collegue ;
 *  - bornee par le nouveau `commentCount` : un fil raccourci (`comment/delete`)
 *    ne garde pas plus de non-lus qu'il n'a de messages.
 * Sur un board-lien, une carte encore inconnue (nee chez un collegue,
 * `card.created`) part de 0 non-lu : c'est exact, une carte nait sans fil, et
 * sans ce depart ses commentaires suivants ne seraient jamais comptes. Un board
 * kanban ne suit pas les non-lus : sa carte reste sans compteur.
 */
export function mergeJournalCard(
  local: Card | undefined,
  incoming: Card,
  payload: Record<string, unknown>,
  viewerId: string | null,
  context: JournalCardContext,
): Card {
  if (incoming.unseenComments !== undefined) return incoming;
  const known = local?.unseenComments ?? (context.tracksUnseen ? 0 : undefined);
  if (known === undefined) return incoming;
  const comment = payload.comment;
  const author = isRecord(comment) && typeof comment.authorId === 'string' ? comment.authorId : null;
  const fromSomeoneElse = author !== null && viewerId !== null && author !== viewerId;
  const unseen = Math.min(incoming.commentCount, known + (fromSomeoneElse && context.fresh ? 1 : 0));
  return { ...incoming, unseenComments: Math.max(0, unseen) };
}

/**
 * Un `column.moved` qui a renumerote d'AUTRES colonnes n'en porte que le
 * NOMBRE dans le journal (`renumbered`) ; la liste des nouveaux rangs n'est que
 * dans la reponse HTTP de l'auteur. Board-lien : chaque colonne virtuelle dont
 * la position change a sa PROPRE activite `column.moved` (§11.9 E8), le rejeu
 * une a une suffit. Board kanban : les rangs renumerotes ne sont nulle part dans
 * le journal, seul un rechargement les donne.
 */
function renumbersUnjournaledColumns(payload: Record<string, unknown>): boolean {
  const count = readNumber(payload, 'renumbered');
  if (count === undefined || count <= 0) return false;
  return !(isColumn(payload.column) && payload.column.virtual === true);
}

/**
 * Cette activite peut-elle etre rejouee a partir de son seul payload ?
 *
 * Le journal porte une INTENTION, pas toujours l'entite complete : un
 * `card.created` qui ne transporte pas la carte ne peut pas etre invente cote
 * client. Plutot que de deviner, on le dit — l'appelant recharge alors
 * l'instantane complet (`board/get`), ce qui reste juste et rare.
 */
function canApply(activity: Activity): boolean {
  const { payload } = activity;
  switch (activity.verb) {
    case 'card.created':
    case 'card.updated':
      return isCard(payload.card);
    case 'card.moved':
      // Le contrat impose l'entite ; l'intention reste acceptee en repli, elle
      // decrit exactement le meme deplacement (colonne + rang du serveur).
      return (
        isCard(payload.card) ||
        (typeof activity.cardId === 'string' &&
          readString(payload, 'toColumnId') !== undefined &&
          readNumber(payload, 'rank') !== undefined)
      );
    case 'card.deleted':
      // Supprimee OU archivee (`payload.archived`, §11.6) : la carte quitte le
      // board, meme rejeu.
      return typeof activity.cardId === 'string';
    case 'column.created':
      return isColumn(payload.column);
    case 'column.updated':
      // `touchedCards` non vide = des `completedAt` ont bascule cote serveur :
      // le payload ne dit pas lesquels sont clos, on recharge.
      return isColumn(payload.column) && !(Array.isArray(payload.touchedCards) && payload.touchedCards.length > 0);
    case 'column.moved':
      return (
        (isColumn(payload.column) ||
          (typeof activity.columnId === 'string' && readNumber(payload, 'rank') !== undefined)) &&
        !renumbersUnjournaledColumns(payload)
      );
    case 'column.deleted':
      // Des cartes ont ete relogees ailleurs : on ne sait pas ou.
      return typeof activity.columnId === 'string' && (readNumber(payload, 'movedCards') ?? 0) === 0;
    case 'board.archived':
      return typeof payload.archived === 'boolean';
    case 'role.updated':
      // Les roles ne vivent pas dans l'instantane (cache `ROLES`, D30) : rien a
      // rejouer ici, et surtout rien a RECHARGER — un role attribue ne change
      // aucune carte. Le polling relit `role/list` (`rolesTouched`).
      return true;
    default:
      // board.created/updated/attached/detached et member.* touchent des
      // donnees que le journal ne detaille pas (droits, profils, labels,
      // jalons d'un board-lien).
      return false;
  }
}

/**
 * `mergeJournalCard` contre la version de la carte deja dans l'instantane.
 *
 * @param startRev revision du tableau AVANT le rejeu : une activite de rang
 *   inferieur ou egal y est deja prise en compte (cf. `JournalCardContext`).
 */
function journalCard(
  snapshot: BoardSnapshot,
  activity: Activity,
  incoming: Card,
  payload: Record<string, unknown>,
  viewerId: string | null,
  startRev: number,
): Card {
  const local = snapshot.cards.find((card) => card._id === incoming._id);
  return mergeJournalCard(local, incoming, payload, viewerId, {
    fresh: activity.rev > startRev,
    tracksUnseen: isCommunecter(snapshot),
  });
}

/**
 * Colonne rejouee d'un `column.moved`. Une colonne VIRTUELLE deja connue ne
 * prend que son RANG : son libelle est calcule dans la langue de l'AUTEUR du
 * deplacement (`lang` de `column/move`, §11.9 E10), et le recopier afficherait
 * aux autres lecteurs le libelle d'une langue qui n'est pas la leur.
 */
function replayMovedColumn(snapshot: BoardSnapshot, column: Column, now: number): BoardSnapshot {
  const local = findColumn(snapshot, column._id);
  if (local && (local.virtual === true || column.virtual === true)) {
    return moveColumnInSnapshot(snapshot, local._id, column.rank, now);
  }
  return upsertColumn(snapshot, column);
}

/**
 * Faut-il recharger l'instantane complet plutot que d'appliquer le delta ?
 *
 * AUCUN filtrage par auteur ici, et c'est delibere : deux onglets du meme
 * utilisateur sont deux clients distincts. Ignorer « mes » activites revenait
 * a consommer leur `rev` sans jamais appliquer leur contenu — le second onglet
 * ne voyait donc jamais ce que le premier venait d'ecrire. Comme les activites
 * transportent l'entite serialisee par le serveur, les rejouer est idempotent :
 * l'onglet auteur reecrit la meme valeur que son optimiste, sans clignotement.
 */
export function requiresFullReload(activities: readonly Activity[]): boolean {
  return activities.some((activity) => !canApply(activity));
}

/**
 * Rejoue un delta d'activites sur un instantane.
 *
 * Reducteur PUR : `(instantane, activites) => instantane`. Il applique ce
 * qu'il sait appliquer et ignore le reste — `requiresFullReload` sert a
 * decider AVANT de l'appeler si le delta suffit.
 *
 * @param viewerId personne connectee : un commentaire qu'elle n'a pas ecrit
 *   compte parmi ses non-lus (cf. `mergeJournalCard`).
 */
export function applyActivities(
  snapshot: BoardSnapshot,
  activities: readonly Activity[],
  now: number = nowTimestamp(),
  viewerId: string | null = null,
): BoardSnapshot {
  if (activities.length === 0) return snapshot;

  // Le journal doit etre rejoue dans l'ordre d'ecriture : deux activites sur
  // la meme carte ne commutent pas (deplacer puis supprimer != l'inverse).
  const ordered = [...activities].sort((a, b) => a.rev - b.rev);
  const startRev = snapshot.board.rev;
  let next = snapshot;

  for (const activity of ordered) {
    if (!canApply(activity)) continue;
    const payload: Record<string, unknown> = isRecord(activity.payload) ? activity.payload : {};

    switch (activity.verb) {
      case 'card.created':
      case 'card.updated': {
        if (isCard(payload.card)) {
          next = upsertCard(next, journalCard(next, activity, payload.card, payload, viewerId, startRev));
        }
        break;
      }
      case 'card.moved': {
        // L'entite serveur fait autorite : elle porte deja la colonne, le rang
        // arbitre par le serveur et le `completedAt` recalcule (RG-30).
        if (isCard(payload.card)) {
          next = upsertCard(next, journalCard(next, activity, payload.card, payload, viewerId, startRev));
          break;
        }
        const columnId = readString(payload, 'toColumnId');
        const rank = readNumber(payload, 'rank');
        // La carte peut etre inconnue si sa creation n'a pas pu etre rejouee :
        // dans ce cas `requiresFullReload` a deja demande un rechargement.
        if (activity.cardId && columnId && rank !== undefined) {
          next = moveCardInSnapshot(next, { cardId: activity.cardId, columnId, rank }, now);
        }
        break;
      }
      case 'card.deleted': {
        if (activity.cardId) next = removeCard(next, activity.cardId);
        break;
      }
      case 'column.created':
      case 'column.updated': {
        if (isColumn(payload.column)) next = upsertColumn(next, payload.column);
        break;
      }
      case 'column.moved': {
        if (isColumn(payload.column)) {
          next = replayMovedColumn(next, payload.column, now);
        } else {
          const rank = readNumber(payload, 'rank');
          if (activity.columnId && rank !== undefined) {
            next = moveColumnInSnapshot(next, activity.columnId, rank, now);
          }
        }
        break;
      }
      case 'column.deleted': {
        if (activity.columnId) next = removeColumn(next, activity.columnId, undefined, now);
        break;
      }
      case 'board.archived': {
        next = patchBoard(next, { status: payload.archived === true ? 'archived' : 'active' });
        break;
      }
      default:
        break;
    }
  }

  // `rev` avance meme sur les activites ignorees : sans cela, le prochain
  // `board/sync` redemanderait indefiniment le meme delta.
  const highestRev = ordered.reduce((max, activity) => Math.max(max, activity.rev), snapshot.board.rev);
  return withRev(next, highestRev);
}

/* -------------------------------------------------------------------------- */
/*  Decision du polling delta                                                 */
/* -------------------------------------------------------------------------- */

export type SyncDecision =
  | { kind: 'reload' }
  | { kind: 'apply'; activities: Activity[] }
  | { kind: 'none' };

/**
 * Que faire d'une reponse de `board/sync` ? Decision PURE, executee par
 * `useBoardSync`.
 *
 * Le cas nouveau du §11 (D17) : une ecriture faite AILLEURS (Kanban gestion,
 * aap.js) n'a aucune ligne de journal ; le serveur la detecte par empreinte et
 * fait avancer `rev` sans activite. Une revision serveur AU-DELA de la
 * derniere activite rendue signale donc une ecriture que le delta ne decrit
 * pas : seul un rechargement complet dit la verite.
 */
export function decideSync(snapshotRev: number, result: SyncResult): SyncDecision {
  if (result.full) return { kind: 'reload' };
  if (result.activities.length > 0) {
    // Le tri ne regarde PAS qui est l'auteur — cf. `requiresFullReload`.
    if (requiresFullReload(result.activities)) return { kind: 'reload' };
    const highest = result.activities.reduce((max, activity) => Math.max(max, activity.rev), 0);
    if (result.rev > highest) return { kind: 'reload' };
    return { kind: 'apply', activities: result.activities };
  }
  // Revision avancee SANS activite : le module PHP incremente `rev` PUIS insere
  // la ligne de journal, en deux operations — un `board/sync` servi entre les
  // deux (ou apres l'echec de l'insertion) recoit `{rev: R+1, activities: []}`.
  // Avancer sans recharger sauterait R+1 pour de bon : la passe suivante part
  // de R+1 et ne recevra jamais l'activite. On recharge ; apres `board/get`, la
  // revision connue rattrape celle du serveur et la decision redevient `none`.
  if (result.rev > snapshotRev) return { kind: 'reload' };
  return { kind: 'none' };
}

/**
 * Le delta touche-t-il les ROLES de l'element (§12, D30) ? Toute activite
 * `role.updated` fait relire `role/list` : le journal ne porte que l'intention
 * (un membre, un role), pas la liste complete que la vue affiche, et un rejeu
 * fin finirait par diverger du serveur sur les colonnes non declarees.
 */
export function rolesTouched(activities: readonly Activity[]): boolean {
  return activities.some((activity) => activity.verb === 'role.updated');
}

/**
 * Plus haute revision portee par une activite `role.updated` du delta, ou
 * `null` si le delta n'en a aucune.
 */
export function rolesRevisionOf(activities: readonly Activity[]): number | null {
  let highest: number | null = null;
  for (const activity of activities) {
    if (activity.verb !== 'role.updated') continue;
    highest = highest === null ? activity.rev : Math.max(highest, activity.rev);
  }
  return highest;
}

/**
 * Faut-il RELIRE la liste des roles apres ce delta ?
 *
 * Le polling ne regarde pas qui est l'auteur (cf. `requiresFullReload`) : il
 * rapporte aussi MES ecritures de roles, deja reglees par `useRoleMutations`
 * (reponse posee dans le cache, puis relecture). Les relire une seconde fois
 * doublait chaque `role/list` — lourd sur un element a 1 700 membres (D20).
 * La liste servie porte la revision du tableau au moment de sa lecture
 * (`RoleListResult.rev`), et chaque ecriture propre y pose la revision de sa
 * reponse : une activite de revision inferieure ou egale est donc deja dans la
 * liste. Sans liste en cache (vue fermee), on relit comme avant — invalider une
 * query absente ne coute rien, et une query fermee sera relue a son ouverture.
 *
 * La revision du tableau n'entre jamais dans ce calcul : avancer `board.rev`
 * depuis une reponse de mutation ferait sauter au polling les activites des
 * autres clients de revision intermediaire.
 */
export function rolesRereadNeeded(activities: readonly Activity[], knownRolesRev: number | undefined): boolean {
  const touched = rolesRevisionOf(activities);
  if (touched === null) return false;
  return knownRolesRev === undefined || touched > knownRolesRev;
}

/**
 * Cartes dont le FIL de commentaires a change dans ce delta : un commentaire
 * ajoute (`payload.comment`) ou supprime (`payload.commentDeleted`). Le cache
 * dedie du fil n'est ecrit que par la modale ; sans cette liste, un fil ouvert
 * ou relu dans la minute garderait l'ancienne version pendant que la carte
 * annonce un message de plus.
 */
export function commentThreadsTouched(activities: readonly Activity[]): string[] {
  const cardIds = new Set<string>();
  for (const activity of activities) {
    if (activity.verb !== 'card.updated' || activity.cardId === null) continue;
    const payload: Record<string, unknown> = isRecord(activity.payload) ? activity.payload : {};
    if (isRecord(payload.comment) || payload.commentDeleted === true) cardIds.add(activity.cardId);
  }
  return [...cardIds];
}

/* -------------------------------------------------------------------------- */
/*  Politique de rollback d'une mutation optimiste                             */
/* -------------------------------------------------------------------------- */

/** Ce qu'il faut faire du cache quand une mutation optimiste echoue. */
export type RollbackDecision = 'none' | 'restore' | 'invalidate';

/**
 * Ce que `onMutate` a retenu du cache avant d'y ecrire son etat optimiste.
 *
 * Generique : la regle vaut pour tout cache ecrit en optimiste — l'instantane
 * du tableau (`BoardSnapshot`, par defaut) comme la liste des roles
 * (`RoleListResult`, §12). Une seule politique de rollback dans le depot.
 */
export interface RollbackWitness<T = BoardSnapshot> {
  /** Photo d'AVANT la mutation. */
  previous?: T;
  /** Valeur REELLEMENT ecrite dans le cache par `onMutate`. */
  optimistic?: T;
}

/**
 * Decide du rollback SANS toucher au cache — d'ou la fonction pure.
 *
 * Le cache d'un tableau est ecrit par douze mutations, par les jalons et par
 * le polling delta. Reposer aveuglement la photo d'avant-mutation alors qu'une
 * autre ecriture est passee entre-temps la PERDRAIT : une carte provisoire
 * `tmp-N` deja remplacee par sa vraie carte ressusciterait (et toute mutation
 * ulterieure sur elle repondrait `notFound`), une renumerotation decidee par le
 * serveur serait annulee. On ne restaure donc que si le cache porte encore
 * EXACTEMENT la valeur ecrite par `onMutate` ; sinon on laisse le serveur
 * trancher.
 *
 * La comparaison est volontairement une IDENTITE de reference : tout le module
 * produit des valeurs neuves a chaque ecriture, si bien qu'une reference
 * intacte prouve qu'aucune autre source n'a ecrit depuis.
 */
export function decideRollback<T>(current: T | undefined, witness: RollbackWitness<T> | undefined): RollbackDecision {
  // Sans ecriture optimiste (ajout de membre, par exemple) il n'y a rien a
  // defaire : le cache n'a jamais ete touche.
  if (!witness?.optimistic || !witness.previous) return 'none';
  return current === witness.optimistic ? 'restore' : 'invalidate';
}
