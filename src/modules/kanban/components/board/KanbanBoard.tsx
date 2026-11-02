import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MeasuringStrategy,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type DropAnimation,
  type MeasuringConfiguration,
  type ScreenReaderInstructions,
} from "@dnd-kit/core";
import { SortableContext, horizontalListSortingStrategy, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { EMPTY_FILTER, filterCards, type BoardFilterCriteria } from "@/modules/kanban/lib/boardFilter";
import { dateZoneFor } from "@/modules/kanban/lib/boardSource";
import type { ActionsViewId } from "@/modules/kanban/lib/kanbanPaths";
import { sortByRank } from "@/modules/kanban/lib/rank";
import type { BoardSnapshot, Card, Column } from "@/modules/kanban/types";
import { createBoardCollisionDetection } from "./boardCollision";
import { hasCanonicalOrder, projectCardDrop, type CardDropMode } from "./canonicalDnd";
import { cardFocusTargetIn } from "./cardFocus";
import { CardPreview } from "./CardPreview";
import type { CreateCardHandler } from "./CardComposer";
import { windowLimitCovering, windowLimitOf, zoneDropTarget } from "./columnView";
import { dragCancelMessage, dragEndMessage, dragOverMessage, dragStartMessage, projectDrag, type DragMessage, type DragNames, type DragScene } from "./dragAnnouncements";
import { resolveDropColumnId } from "./dropTarget";
import { hasActiveCriteria } from "./filterBar";
import { visibleColumnIds } from "./hiddenColumns";
import { KanbanColumn, type ColumnDecoration } from "./KanbanColumn";
import {
  buildCardOrder,
  cardMoveRequest,
  columnMoveRequest,
  columnOfCard,
  columnSortableId,
  dropTargetOfRequest,
  indexLabels,
  indexMembers,
  isCardDragData,
  isColumnDragData,
  moveColumnInOrder,
  resolveColumnTitle,
  sameCardRequest,
  sameColumnRequest,
  shouldPlaceAfter,
  targetCardOf,
  type BoardDragData,
  type CardDropTarget,
  type CardMoveRequest,
  type CardMoveTarget,
  type CardOrder,
  type ColumnMoveRequest,
} from "./kanbanDnd";
import { useAnnouncer } from "./useAnnouncer";
import { useDayClock } from "./useDayClock";
import { useStableCardOrder } from "./useStableCardOrder";

export interface KanbanBoardProps {
  snapshot: BoardSnapshot;
  onMoveCard: (intent: CardMoveRequest) => void;
  onMoveColumn: (intent: ColumnMoveRequest) => void;
  /** Branché par la vue quand la création de carte est permise ; relayé au composeur des colonnes. */
  onCreateCard?: CreateCardHandler;
  /** Archive une carte de la colonne de fin (branché si `canArchiveCards`). */
  onArchiveCard?: (cardId: string) => void;
  /**
   * Critères de la barre de filtres (recherche comprise), appliqués à l'instantané DÉJÀ chargé :
   * aucune requête n'est refaite.
   */
  criteria?: BoardFilterCriteria;
  /** Colonnes masquées sur ce poste (préférence locale, élaguée par la vue). */
  hiddenColumnIds?: readonly string[];
  /**
   * Masque une colonne depuis son menu ; la vue annonce et déplace le focus. Absent : le masquage
   * ne s'applique pas (vue Jalons, dont les colonnes sont des jalons).
   */
  onHideColumn?: (columnId: string) => void;
  /**
   * Colonne AFFICHÉE d'une carte ; par défaut son statut (`columnId`). La vue Jalons range les
   * mêmes cartes par jalon. Doit être STABLE (`useCallback`) : l'ordre affiché en dépend.
   */
  cardColumnOf?: (card: Card) => string;
  /** Ce qu'une vue ajoute à l'en-tête de certaines colonnes (clé : id de colonne). */
  columnDecorations?: ReadonlyMap<string, ColumnDecoration>;
  /** Ce que désignent les colonnes, pour les mots de « Déplacer vers… ». */
  moveTarget?: CardMoveTarget;
  /** Vue qui affiche le tableau : la fiche d'une carte s'ouvre par-dessus elle. */
  view?: ActionsViewId;
  /** Bouton pointillé après la dernière colonne (vue Jalons : « Ajouter un jalon »). */
  addColumn?: { label: string; onClick: () => void };
  className?: string;
}

const NO_HIDDEN_COLUMNS: readonly string[] = [];

/*
 * `Always` est obligatoire dans un tableau multi-colonnes : sans re-mesure, une colonne dont la
 * hauteur change quand une carte y entre garde son ancien rectangle et les dépôts suivants
 * visent à côté.
 */
const MEASURING: MeasuringConfiguration = {
  droppable: { strategy: MeasuringStrategy.Always },
};

const DROP_ANIMATION: DropAnimation = {
  duration: 180,
  easing: "cubic-bezier(0, 0, 0.2, 1)",
};

type DragActive = DragOverEvent["active"];
type DragOver = NonNullable<DragOverEvent["over"]>;

/** Le pointeur a-t-il franchi le milieu de l'élément survolé ? */
function placeAfterFromRects(active: DragActive, over: DragOver): boolean {
  const translated = active.rect.current.translated;
  if (translated === null) return false;
  return shouldPlaceAfter(translated.top, over.rect.top, over.rect.height);
}

/**
 * Le tableau des actions : colonnes de statut, cartes, glisser-déposer à la souris, au doigt et
 * au clavier. Repris de co-kanban (`components/board/KanbanBoard.tsx`), logique de glisser
 * comprise ; seuls les gestes d'un tableau autonome (gérer les colonnes) sont retirés. La vue
 * Jalons le réutilise : ses colonnes sont des jalons (`cardColumnOf`, `columnDecorations`).
 */
export function KanbanBoard({
  snapshot,
  onMoveCard,
  onMoveColumn,
  onCreateCard,
  onArchiveCard,
  criteria = EMPTY_FILTER,
  hiddenColumnIds = NO_HIDDEN_COLUMNS,
  onHideColumn,
  cardColumnOf,
  columnDecorations,
  moveTarget = "column",
  view = "kanban",
  addColumn,
  className,
}: KanbanBoardProps) {
  const { t } = useTranslation("modules/kanban");
  const translate = useCallback((key: string, fallback: string) => t(key, fallback), [t]);
  /*
   * Tableau relié : l'ordre dans une colonne est CANONIQUE (D16). Le glisser ne promet donc
   * jamais une place que le serveur ne donnera pas.
   */
  const canonical = hasCanonicalOrder(snapshot.capabilities.source);
  const showCreditsTotal = snapshot.capabilities.source === "communecter";
  // Jour civil des échéances : celui du navigateur sur un tableau relié, comme Kanban gestion
  // qui les saisit ainsi (`lib/dates`).
  const dateZone = dateZoneFor(snapshot.capabilities.source);

  const [activeDrag, setActiveDrag] = useState<BoardDragData | null>(null);
  /*
   * Aperçus locaux du geste en cours. Ils ne vivent QUE le temps du glisser : dès le dépôt, la
   * mutation optimiste du cache reprend la main.
   */
  const [previewOrder, setPreviewOrder] = useState<CardOrder | null>(null);
  const [previewColumns, setPreviewColumns] = useState<readonly string[] | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  /*
   * L'instant courant, à la JOURNÉE (`useDayClock`) : 0 au rendu serveur et au premier rendu
   * client — aucune carte « en retard », HTML identique des deux côtés — puis il ne change qu'à
   * minuit.
   */
  const nowSeconds = useDayClock();
  /*
   * Fenêtre de cartes rendues, par colonne (« Afficher N de plus »). Elle vit ICI et non dans la
   * colonne : le dépôt sur la zone d'une colonne tronquée et l'élargissement après un dépôt
   * lointain en ont besoin.
   */
  const [windowLimits, setWindowLimits] = useState<Readonly<Record<string, number>>>({});
  const [announcement, announce] = useAnnouncer();

  useEffect(() => {
    /*
     * `prefers-reduced-motion` ne suffit pas en CSS : l'animation de dépôt de dnd-kit passe par
     * l'API Web Animations, que la media query ne neutralise pas.
     */
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  const sortedColumns = useMemo(() => sortByRank(snapshot.columns), [snapshot.columns]);
  /*
   * Les colonnes masquées sur ce poste sortent de l'ORDRE AFFICHÉ, pas de l'instantané : un
   * déplacement de colonne se calcule alors entre voisines visibles, ce qui est exactement ce
   * que l'on voit. « Déplacer vers… » propose toujours TOUTES les colonnes.
   */
  const baseColumnIds = useMemo(
    () =>
      visibleColumnIds(
        sortedColumns.map((column) => column._id),
        hiddenColumnIds,
      ),
    [sortedColumns, hiddenColumnIds],
  );
  /*
   * Le filtre agit sur l'ORDRE AFFICHÉ : les colonnes restent toutes visibles (une colonne
   * filtrée à vide dit « rien ne passe »), et un déplacement se calcule entre voisins VISIBLES.
   *
   * DIFFÉRÉ (`useDeferredValue`) : le champ de recherche se met à jour tout de suite, le tableau
   * suit dans un rendu interruptible. Sur un projet de mille actions, chaque frappe figeait la
   * saisie le temps de tout rendre.
   */
  const deferredCriteria = useDeferredValue(criteria);
  const visibleCards = useMemo(() => filterCards(snapshot, deferredCriteria, nowSeconds), [snapshot, deferredCriteria, nowSeconds]);
  const filtering = hasActiveCriteria(deferredCriteria);
  const builtCardOrder = useMemo(
    () => buildCardOrder(sortedColumns, cardColumnOf ? visibleCards.map((card) => ({ _id: card._id, rank: card.rank, columnId: cardColumnOf(card) })) : visibleCards),
    [sortedColumns, visibleCards, cardColumnOf],
  );
  // Chaque colonne inchangée garde son tableau : ni elle ni ses cartes ne se rendent de nouveau
  // quand la recherche n'a touché qu'une autre colonne.
  const baseCardOrder = useStableCardOrder(builtCardOrder);
  const columnsById = useMemo(() => new Map<string, Column>(sortedColumns.map((column) => [column._id, column])), [sortedColumns]);
  const cardsById = useMemo(() => new Map<string, Card>(snapshot.cards.map((card) => [card._id, card])), [snapshot.cards]);
  // Rang d'une carte pour l'aperçu canonique : celui de l'instantané, déjà canonique.
  const rankOf = useCallback((cardId: string) => cardsById.get(cardId)?.rank ?? Number.POSITIVE_INFINITY, [cardsById]);
  // Règle d'ordre, partagée par l'aperçu, le dépôt et les annonces (`projectCardDrop`).
  const dropMode: CardDropMode = useMemo(() => ({ canonical, rankOf }), [canonical, rankOf]);
  const memberIndex = useMemo(() => indexMembers(snapshot.members), [snapshot.members]);
  const labelIndex = useMemo(() => indexLabels(snapshot.board.labels), [snapshot.board.labels]);

  const cardOrder = previewOrder ?? baseCardOrder;
  const columnIds = previewColumns ?? baseColumnIds;
  const columnItems = useMemo(() => columnIds.map(columnSortableId), [columnIds]);

  /*
   * Les cartes reçoivent des LECTEURS (ordre, carte), pas les valeurs : sinon chaque aperçu de
   * glisser, ou chaque rechargement du tableau, changerait une prop de toutes les cartes et
   * ruinerait leur mémoïsation.
   */
  const cardOrderRef = useRef(cardOrder);
  const liveRef = useRef({ cardOrder, baseCardOrder, columnIds, cardsById, columnsById, dropMode, windowLimits });
  useEffect(() => {
    // Volontairement sans tableau de dépendances : ces références reflètent le dernier rendu.
    cardOrderRef.current = cardOrder;
    liveRef.current = { cardOrder, baseCardOrder, columnIds, cardsById, columnsById, dropMode, windowLimits };
  });
  const getCardOrder = useCallback(() => cardOrderRef.current, []);
  const getCard = useCallback((cardId: string) => liveRef.current.cardsById.get(cardId), []);
  // Une instance pour la vie du tableau : la détection retient la colonne du geste en cours.
  // `useState` et non `useMemo` : React peut jeter un cache `useMemo`, pas un état.
  const [collisionDetection] = useState(createBoardCollisionDetection);

  /** Élargit la fenêtre d'une colonne (bouton « Afficher N de plus », carte à montrer). */
  const handleLimitChange = useCallback((columnId: string, limit: number) => {
    setWindowLimits((current) => (windowLimitOf(current, columnId) >= limit ? current : { ...current, [columnId]: limit }));
  }, []);

  /*
   * Une carte déplacée loin dans sa colonne d'arrivée (rang canonique) tomberait sous « Afficher
   * N de plus » et semblerait avoir disparu : la fenêtre s'élargit jusqu'à elle.
   */
  const revealInOrder = useCallback((order: CardOrder, cardId: string) => {
    const columnId = columnOfCard(order, cardId);
    if (columnId === null) return;
    const index = order[columnId].indexOf(cardId);
    setWindowLimits((current) => {
      const limit = windowLimitOf(current, columnId);
      const next = windowLimitCovering(index, limit);
      return next === limit ? current : { ...current, [columnId]: next };
    });
  }, []);

  /*
   * DÉPÔT AU CLAVIER dans une autre colonne : la carte est démontée de sa colonne et remontée
   * dans l'autre. dnd-kit rend le focus à la poignée d'ORIGINE, qui disparaît aussitôt : le
   * focus tombait sur <body>. On le pose donc sur la poignée de la carte une fois arrivée, sauf
   * si quelqu'un l'a déjà placé ailleurs. « Déplacer vers… » passe par le même chemin.
   */
  const boardListRef = useRef<HTMLUListElement>(null);
  const focusAfterDropRef = useRef<{ cardId: string; columnId: string } | null>(null);
  useEffect(() => {
    const pending = focusAfterDropRef.current;
    if (pending === null || columnOfCard(baseCardOrder, pending.cardId) !== pending.columnId) return;
    focusAfterDropRef.current = null;
    const active = document.activeElement;
    if (active !== null && active !== document.body) return;
    cardFocusTargetIn(boardListRef.current, pending.cardId)?.focus();
  }, [baseCardOrder]);

  /*
   * « Déplacer vers… » : même projection que le glisser, puis l'intention part. Une carte qui
   * change de colonne emporte son menu, que la boîte voulait refocaliser : le focus la suit dans
   * sa nouvelle colonne (constat du portage, la carte de co-kanban le perdait).
   */
  const handleMoveFromMenu = useCallback(
    (intent: CardMoveRequest) => {
      const { cardOrder: order, baseCardOrder: base, dropMode: mode } = liveRef.current;
      revealInOrder(projectCardDrop(order, intent.cardId, dropTargetOfRequest(intent), mode), intent.cardId);
      if (intent.columnId !== columnOfCard(base, intent.cardId)) focusAfterDropRef.current = { cardId: intent.cardId, columnId: intent.columnId };
      onMoveCard(intent);
    },
    [onMoveCard, revealInOrder],
  );

  /*
   * Cible d'un dépôt : la carte survolée et le côté franchi, ou la ZONE de la colonne — après la
   * dernière carte AFFICHÉE quand la colonne est tronquée (`zoneDropTarget`). Lue sur `liveRef` :
   * elle sert aussi aux annonces.
   */
  const dropTargetFor = useCallback((active: DragActive, over: DragOver, toColumnId: string): CardDropTarget => {
    const overCardId = targetCardOf(over.data.current);
    if (overCardId !== null) {
      return { columnId: toColumnId, overCardId, placeAfter: placeAfterFromRects(active, over) };
    }
    const { cardOrder: order, windowLimits: limits } = liveRef.current;
    return { columnId: toColumnId, ...zoneDropTarget(order[toColumnId] ?? [], windowLimitOf(limits, toColumnId)) };
  }, []);

  /*
   * SOURIS ET TACTILE SONT SÉPARÉS depuis que la fiche entière est la prise. Un `PointerSensor`
   * unique imposerait `touch-action: none` sur toute la carte, et supprimerait le défilement au
   * doigt — à 375 px une carte occupe presque toute la largeur. Le tactile passe donc par un
   * APPUI LONG : un glissement du doigt reste un défilement, un appui maintenu saisit la carte.
   */
  const sensors = useSensors(
    // 6 px de tolérance : sans elle, le moindre frémissement déclencherait un glisser.
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // 220 ms avant la saisie, 8 px de marge : au-delà, c'est un défilement.
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  /*
   * ANNONCES DU LECTEUR D'ÉCRAN : la projection et le choix du message sont des fonctions pures
   * (`dragAnnouncements`, testées dans les deux modes). Ici ne restent que la lecture du dernier
   * rendu (`liveRef`), la cible lue sur les rectangles (`dropTargetFor`) et la traduction.
   */
  const announcements: Announcements = useMemo(() => {
    const names: DragNames = {
      cardTitle: (cardId) => liveRef.current.cardsById.get(cardId)?.title ?? cardId,
      columnTitle: (columnId) => {
        const column = liveRef.current.columnsById.get(columnId);
        return column ? resolveColumnTitle(column, translate) : columnId;
      },
    };
    const scene = (): DragScene => {
      const { cardOrder: order, baseCardOrder: base, columnIds: ids, dropMode: mode } = liveRef.current;
      return { cardOrder: order, baseCardOrder: base, columnIds: ids, mode };
    };
    const say = (message: DragMessage | undefined) => (message === undefined ? undefined : t(message.key, message.fallback, message.values));
    // Où l'élément atterrirait : la MÊME projection que l'aperçu et le dépôt.
    const project = (active: DragActive, over: DragOver | null) => {
      if (over === null) return null;
      const current = scene();
      const toColumnId = resolveDropColumnId(current.cardOrder, over.data.current);
      if (toColumnId === null) return null;
      return projectDrag(active.data.current, toColumnId, dropTargetFor(active, over, toColumnId), current);
    };

    return {
      onDragStart: ({ active }) => say(dragStartMessage(active.data.current, scene(), names)),
      onDragOver: ({ active, over }) => say(dragOverMessage(project(active, over), names)),
      onDragEnd: ({ active, over }) => say(dragEndMessage(project(active, over), scene(), names)),
      onDragCancel: ({ active }) => say(dragCancelMessage(active.data.current, names)),
    };
  }, [t, translate, dropTargetFor]);

  const screenReaderInstructions: ScreenReaderInstructions = useMemo(
    // Tableau relié : les instructions disent d'emblée que l'ordre d'une colonne est
    // automatique, et que seul le changement de colonne compte.
    () => ({ draggable: canonical ? t("dnd.howToCanonical") : t("dnd.howTo") }),
    [canonical, t],
  );

  const accessibility = useMemo(() => ({ announcements, screenReaderInstructions }), [announcements, screenReaderInstructions]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const data = event.active.data.current;
    // Un nouveau geste annule un focus en attente d'un dépôt précédent.
    focusAfterDropRef.current = null;
    if (isCardDragData(data) || isColumnDragData(data)) setActiveDrag(data);
  }, []);

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { active, over } = event;
      if (over === null) return;
      const data = active.data.current;
      /*
       * La colonne cible se lit sur l'ordre AFFICHÉ (`liveRef`) et non sur la `dragData` de
       * l'élément survolé : celle-ci porte encore la colonne de l'instantané serveur, donc une
       * carte déjà déplacée par l'aperçu se déclarerait dans son ancienne colonne et l'aperçu
       * ferait la navette entre les deux.
       */
      const toColumnId = resolveDropColumnId(liveRef.current.cardOrder, over.data.current);
      if (toColumnId === null) return;

      if (isCardDragData(data)) {
        const target = dropTargetFor(active, over, toColumnId);
        setPreviewOrder((current) => {
          const base = current ?? baseCardOrder;
          if (!canonical) {
            // Aucun aperçu tant que la carte reste dans sa colonne : la stratégie de tri de
            // dnd-kit y dessine déjà le décalage, sans faire re-rendre le tableau.
            const from = columnOfCard(base, data.cardId);
            if (from === null || from === toColumnId) return current;
          }
          // Tableau relié : la carte apparaît d'emblée à son rang canonique dans la colonne
          // survolée, et ne bouge pas dans la sienne.
          const next = projectCardDrop(base, data.cardId, target, dropMode);
          return next === base ? current : next;
        });
        return;
      }

      if (isColumnDragData(data)) {
        setPreviewColumns((current) => {
          const base = current ?? baseColumnIds;
          const next = moveColumnInOrder(base, data.columnId, toColumnId);
          return next === base ? current : next;
        });
      }
    },
    [baseCardOrder, baseColumnIds, canonical, dropMode, dropTargetFor],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      const data = active.data.current;
      const displayedOrder = previewOrder ?? baseCardOrder;
      // Même lecture qu'au survol : l'ordre affiché fait foi (cf. `dropTarget`).
      const toColumnId = resolveDropColumnId(displayedOrder, over?.data.current);

      if (isCardDragData(data) && over !== null && toColumnId !== null) {
        const next = projectCardDrop(displayedOrder, data.cardId, dropTargetFor(active, over, toColumnId), dropMode);
        const intent = cardMoveRequest(next, data.cardId);
        // On compare les INTENTIONS, pas les ordres : l'aperçu a déjà déplacé la carte, seule
        // compte la place vue du serveur. Un geste blanc n'envoie aucune requête.
        if (intent !== null && !sameCardRequest(intent, cardMoveRequest(baseCardOrder, data.cardId))) {
          revealInOrder(next, data.cardId);
          if (event.activatorEvent instanceof KeyboardEvent && intent.columnId !== columnOfCard(baseCardOrder, data.cardId)) {
            focusAfterDropRef.current = { cardId: data.cardId, columnId: intent.columnId };
          }
          onMoveCard(intent);
        }
      } else if (isColumnDragData(data)) {
        /*
         * L'APERÇU FAIT FOI, on ne rejoue pas le déplacement dessus : `moveColumnInOrder`
         * appliqué une seconde fois au résultat du survol ramènerait la colonne d'où elle vient.
         * On ne calcule depuis l'ordre de référence que sans aperçu (lâcher immédiat).
         */
        const next = previewColumns ?? (toColumnId === null ? baseColumnIds : moveColumnInOrder(baseColumnIds, data.columnId, toColumnId));
        const intent = columnMoveRequest(next, data.columnId);
        if (intent !== null && !sameColumnRequest(intent, columnMoveRequest(baseColumnIds, data.columnId))) {
          onMoveColumn(intent);
        }
      }

      // L'aperçu est relâché immédiatement : c'est la mutation optimiste qui porte désormais le
      // déplacement. Le conserver jusqu'à la réponse figerait le tableau dans un état faux.
      setActiveDrag(null);
      setPreviewOrder(null);
      setPreviewColumns(null);
    },
    [baseCardOrder, baseColumnIds, previewOrder, previewColumns, onMoveCard, onMoveColumn, dropMode, dropTargetFor, revealInOrder],
  );

  const handleDragCancel = useCallback(() => {
    setActiveDrag(null);
    setPreviewOrder(null);
    setPreviewColumns(null);
  }, []);

  const activeCardId = activeDrag && isCardDragData(activeDrag) ? activeDrag.cardId : null;
  const draggedCard = activeCardId !== null ? cardsById.get(activeCardId) : undefined;
  const draggedColumn = activeDrag && isColumnDragData(activeDrag) ? columnsById.get(activeDrag.columnId) : undefined;

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        measuring={MEASURING}
        accessibility={accessibility}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <SortableContext items={columnItems} strategy={horizontalListSortingStrategy}>
          <ul
            ref={boardListRef}
            aria-label={t("board.columns")}
            className={cn(
              // Gouttière et défilement horizontal à barre fine VISIBLE. Dès 768 px, la liste
              // prend toute la hauteur offerte et chaque colonne défile en interne.
              // `relative` : bloc conteneur des textes `sr-only`, qui sinon échappent au rognage
              // et élargissent toute la page (débordement de 1 500 px mesuré à 375 px).
              "ck-scroll-x ck-snap-x relative flex items-start gap-[var(--ck-column-gutter)] md:h-full",
              className,
            )}
          >
            {columnIds.map((columnId) => {
              const column = columnsById.get(columnId);
              if (!column) return null;
              const ids = cardOrder[columnId] ?? [];
              return (
                <KanbanColumn
                  key={columnId}
                  column={column}
                  cardIds={ids}
                  cardsById={cardsById}
                  columns={sortedColumns}
                  getCard={getCard}
                  getCardOrder={getCardOrder}
                  memberIndex={memberIndex}
                  labelIndex={labelIndex}
                  nowSeconds={nowSeconds}
                  dateZone={dateZone}
                  canEditCards={snapshot.capabilities.canEditCards}
                  canReorderColumns={snapshot.capabilities.canReorderColumns}
                  isFiltered={filtering}
                  canonical={canonical}
                  showCreditsTotal={showCreditsTotal}
                  visibleLimit={windowLimitOf(windowLimits, columnId)}
                  onLimitChange={handleLimitChange}
                  // Seule la colonne qui porte la carte tenue la reçoit : les autres gardent les
                  // mêmes props et ne se rendent pas.
                  pinnedCardId={activeCardId !== null && ids.includes(activeCardId) ? activeCardId : null}
                  onMoveCard={handleMoveFromMenu}
                  onCreateCard={onCreateCard}
                  onArchiveCard={onArchiveCard}
                  onHide={onHideColumn}
                  decoration={columnDecorations?.get(columnId)}
                  moveTarget={moveTarget}
                  view={view}
                  announce={announce}
                />
              );
            })}

            {/* Le pointillé dit « emplacement » ; son contour tient 3:1 (`--ck-border-strong`). */}
            {addColumn ? (
              <li className="flex shrink-0 list-none">
                <button
                  type="button"
                  onClick={addColumn.onClick}
                  className={cn(
                    "inline-flex h-11 cursor-pointer items-center gap-2 rounded-2xl border border-dashed border-[var(--ck-border-strong)] bg-[var(--ck-column-fill)] px-4 text-sm text-foreground",
                    "transition-colors duration-[var(--ck-duration-out)] ease-in hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  )}
                >
                  <Plus aria-hidden className="size-4 shrink-0" />
                  {addColumn.label}
                </button>
              </li>
            ) : null}
          </ul>
        </SortableContext>

        <DragOverlay dropAnimation={reducedMotion ? null : DROP_ANIMATION}>
          {draggedCard ? (
            <CardPreview
              card={draggedCard}
              memberIndex={memberIndex}
              labelIndex={labelIndex}
              nowSeconds={nowSeconds}
              dateZone={dateZone}
              inDoneColumn={columnsById.get(cardColumnOf ? cardColumnOf(draggedCard) : draggedCard.columnId)?.isDoneColumn === true}
              draggable
              lifted
              className="w-[calc(var(--ck-column-width)_-_2*var(--ck-column-padding))] cursor-grabbing"
            />
          ) : null}
          {draggedColumn ? (
            <div className="w-[var(--ck-column-width)] cursor-grabbing rounded-2xl border border-border bg-card px-[var(--ck-column-padding)] shadow-[var(--ck-shadow-drag)]">
              <div className="flex h-[var(--ck-column-header)] items-center gap-2">
                <span className="truncate text-sm font-semibold text-foreground">{resolveColumnTitle(draggedColumn, translate)}</span>
                <span className="inline-flex h-5 min-w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 px-2 text-xs font-semibold text-foreground tabular-nums">
                  {(cardOrder[draggedColumn._id] ?? []).length}
                </span>
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Région vivante du tableau, MONTÉE dès le rendu serveur et vide : cartes révélées, carte
          placée à son rang. dnd-kit a la sienne pour le glisser. */}
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </>
  );
}
