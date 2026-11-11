/**
 * Vue Jalons du tableau des actions, logique PURE. Reprise de co-kanban
 * (`pages/board/milestonesView.ts`), tests compris.
 *
 * C'est la vue de Kanban gestion qui range les actions par JALON au lieu de les ranger par statut
 * (`gestion.php`, `init_jalons`) :
 *  - une colonne « Sans jalon », puis une par jalon OUVERT, dans l'ordre du projet (les jalons
 *    clos sont masqués, comme le réglage par défaut de gestion) ;
 *  - les actions TERMINÉES n'y figurent pas : la vue montre le travail qui reste, étape par
 *    étape ; chaque colonne dit seulement combien elle en compte ;
 *  - déposer une carte sur une autre colonne change son jalon (`card/update {milestoneId}`),
 *    jamais son statut.
 *
 * Le tableau affiché reste celui du Tableau (`KanbanBoard`) : ce module ne fabrique que ses
 * colonnes, ses cartes et la colonne de chacune. Le jalon d'une carte créée depuis le Tableau
 * filtré sur un jalon, lui, vit avec la barre de filtres (`composerMilestoneId`).
 */
import { isCardDone } from '@/modules/kanban/lib/boardStats';
import type { BoardSnapshot, Card, Column, Milestone } from '@/modules/kanban/types';

/** Colonne « Sans jalon ». Hors de l'espace des ids préfixés : aucune collision possible. */
export const NO_MILESTONE_COLUMN_ID = 'no-milestone';

const MILESTONE_COLUMN_PREFIX = 'milestone:';

/** Identifiant de la colonne d'un jalon (préfixe : jamais confondu avec un statut). */
export function milestoneColumnId(milestoneId: string): string {
  return `${MILESTONE_COLUMN_PREFIX}${milestoneId}`;
}

/**
 * Jalon désigné par une colonne de la vue : son id, `null` pour « Sans jalon » (détacher),
 * `undefined` pour une colonne inconnue (rien à écrire).
 */
export function milestoneIdOfColumn(columnId: string): string | null | undefined {
  if (columnId === NO_MILESTONE_COLUMN_ID) return null;
  if (!columnId.startsWith(MILESTONE_COLUMN_PREFIX)) return undefined;
  const id = columnId.slice(MILESTONE_COLUMN_PREFIX.length);
  return id === '' ? undefined : id;
}

/** Une colonne de la vue, et ce que son en-tête affiche. */
export interface MilestoneColumnMeta {
  columnId: string;
  /** `null` pour « Sans jalon ». */
  milestone: Milestone | null;
  /** Cartes TERMINÉES de ce jalon : absentes de la vue, comptées dans l'en-tête. */
  doneCount: number;
}

export interface MilestoneBoard {
  /** Colonnes, au format du tableau : « Sans jalon », puis les jalons ouverts. */
  columns: Column[];
  meta: MilestoneColumnMeta[];
  /** Cartes de la vue : non terminées, sans jalon ou rattachées à un jalon ouvert. */
  cards: Card[];
  /** Colonne de chaque carte de la vue (clé : id de carte). */
  columnOf: ReadonlyMap<string, string>;
  /**
   * Cartes non terminées rattachées à un jalon CLOS (ou disparu du projet) : aucune colonne ne
   * les porte, la vue le dit au lieu de les taire.
   */
  hiddenClosedCount: number;
}

function viewColumn(boardId: string, columnId: string, title: string, index: number, cardCount: number): Column {
  return {
    _id: columnId,
    boardId,
    title,
    // Le titre s'affiche tel quel : un nom de jalon ne se traduit pas.
    titleKey: null,
    // Position × 1000, comme les colonnes virtuelles d'un tableau relié.
    rank: (index + 1) * 1000,
    color: null,
    wipLimit: null,
    isDoneColumn: false,
    cardCount,
    creator: '',
    created: 0,
    updated: 0,
    // Une colonne de vue n'existe dans aucune collection : ni renommage, ni suppression.
    virtual: true,
  };
}

/**
 * Colonnes et cartes de la vue Jalons. Le jalon d'une carte est lu sur sa copie
 * (`card.milestone`) et confronté à la liste du projet, plus fraîche : un jalon clos ou supprimé
 * depuis ne porte plus de colonne.
 */
export function buildMilestoneBoard(snapshot: BoardSnapshot, noMilestoneTitle: string): MilestoneBoard {
  const open = snapshot.milestones.filter((milestone) => milestone.status === 'open');
  const openIds = new Set(open.map((milestone) => milestone.milestoneId));

  const cards: Card[] = [];
  const columnOf = new Map<string, string>();
  const openCounts = new Map<string, number>();
  const doneCounts = new Map<string, number>();
  let hiddenClosedCount = 0;

  for (const card of snapshot.cards) {
    const milestoneId = card.milestone?.milestoneId ?? null;
    const columnId = milestoneId === null ? NO_MILESTONE_COLUMN_ID : openIds.has(milestoneId) ? milestoneColumnId(milestoneId) : null;

    if (isCardDone(card)) {
      if (columnId !== null) doneCounts.set(columnId, (doneCounts.get(columnId) ?? 0) + 1);
      continue;
    }
    if (columnId === null) {
      hiddenClosedCount += 1;
      continue;
    }
    cards.push(card);
    columnOf.set(card._id, columnId);
    openCounts.set(columnId, (openCounts.get(columnId) ?? 0) + 1);
  }

  const meta: MilestoneColumnMeta[] = [
    { columnId: NO_MILESTONE_COLUMN_ID, milestone: null, doneCount: doneCounts.get(NO_MILESTONE_COLUMN_ID) ?? 0 },
    ...open.map((milestone) => {
      const columnId = milestoneColumnId(milestone.milestoneId);
      return { columnId, milestone, doneCount: doneCounts.get(columnId) ?? 0 };
    }),
  ];

  const columns = meta.map((entry, index) => viewColumn(snapshot.board._id, entry.columnId, entry.milestone?.name ?? noMilestoneTitle, index, openCounts.get(entry.columnId) ?? 0));

  return { columns, meta, cards, columnOf, hiddenClosedCount };
}

/**
 * Instantané présenté au tableau : les colonnes et les cartes de la vue, et des capacités qui
 * ferment la gestion des COLONNES (ce sont des jalons : on ne les réordonne ni ne les renomme
 * ici). Les droits sur les cartes, eux, restent ceux du serveur.
 */
export function milestoneViewSnapshot(snapshot: BoardSnapshot, board: MilestoneBoard): BoardSnapshot {
  return {
    ...snapshot,
    columns: board.columns,
    cards: board.cards,
    capabilities: {
      ...snapshot.capabilities,
      canManageColumns: false,
      canReorderColumns: false,
      canRenameColumns: false,
    },
  };
}

/**
 * Colonne de STATUT d'une carte créée depuis la vue Jalons : « À faire » (`todo`), comme gestion,
 * sinon la première colonne ouverte du tableau.
 */
export function newCardStatusColumnId(columns: readonly Pick<Column, '_id' | 'isDoneColumn' | 'rank'>[]): string | undefined {
  if (columns.some((column) => column._id === 'todo')) return 'todo';
  const ordered = [...columns].sort((a, b) => a.rank - b.rank);
  return (ordered.find((column) => !column.isDoneColumn) ?? ordered[0])?._id;
}
