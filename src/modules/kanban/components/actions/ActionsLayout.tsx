import { Suspense, useCallback, useMemo, useRef, useState, type RefObject } from "react";
import { Columns3, Eye, Link2, RefreshCw, Settings2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Outlet, useMatch, useNavigate } from "react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { BoardFilterBar } from "@/modules/kanban/components/board/BoardFilterBar";
import { useBoardPrefs } from "@/modules/kanban/components/board/boardPrefs";
import { BoardPrefsProvider } from "@/modules/kanban/components/board/BoardPrefsProvider";
import { useBoardSearch } from "@/modules/kanban/components/board/boardSearch";
import { cardLinkIn } from "@/modules/kanban/components/board/cardFocus";
import type { ColumnVisibilityEntry } from "@/modules/kanban/components/board/ColumnVisibilityDialog";
import { pruneHiddenColumns } from "@/modules/kanban/components/board/hiddenColumns";
import { resolveColumnTitle } from "@/modules/kanban/components/board/kanbanDnd";
import { useAnnouncer } from "@/modules/kanban/components/board/useAnnouncer";
import { useFocusAfterChange } from "@/modules/kanban/components/board/useFocusAfterChange";
import { ActionMenu, type ActionMenuItem } from "@/modules/kanban/components/ui/ActionMenu";
import { FailureNotice } from "@/modules/kanban/components/ui/FailureNotice";
// Chargées à la demande, à la première ouverture (`lazyDialogs`).
import { CardDialog, ColumnVisibilityDialog, MilestonesDialog } from "@/modules/kanban/lazyDialogs";
import { useBoard } from "@/modules/kanban/hooks/useBoard";
import { useBoardMutations } from "@/modules/kanban/hooks/useBoardMutations";
import { useBoardSync } from "@/modules/kanban/hooks/useBoardSync";
import { useCurrentUserId } from "@/modules/kanban/hooks/useKanbanSession";
import { hasMilestones } from "@/modules/kanban/lib/boardSource";
import { boardProgress } from "@/modules/kanban/lib/boardStats";
import { actionsViewPath, KANBAN_ACTIONS_PATH, parseActionsPath } from "@/modules/kanban/lib/kanbanPaths";
import { sortByRank } from "@/modules/kanban/lib/rank";
import type { BoardSnapshot } from "@/modules/kanban/types";
import type { ActionsOutletContext } from "./actionsOutlet";
import { actionsViewById, menuViews } from "./actionsViews";
import { BoardViewControls } from "./BoardViewControls";
import { ViewSwitcher } from "./ViewSwitcher";

export interface ActionsLayoutProps {
  /** Le tableau relié à l'élément porteur (`useContextBoard`). */
  boardId: string;
  /** Titre de la page : il reprend le focus quand la commande qui l'avait disparaît. */
  titleRef: RefObject<HTMLHeadingElement | null>;
}

/** Une seule boîte de la mise en page à la fois : deux booléens laisseraient les boîtes s'empiler. */
type LayoutDialog = "columns" | "milestones";

/**
 * Mise en page du tableau des actions : avancement, sélecteur de vues et menu « ⋯ », barre de
 * filtres, puis la vue de la route fille (`<Outlet>`). Reprise de co-kanban (`BoardLayout`).
 *
 * C'est le PARENT des routes de vue : l'en-tête n'est pas démonté quand on passe du Tableau à la
 * Liste, l'instantané (`useBoard`) n'est chargé qu'une fois, la recherche et les filtres suivent.
 * Le polling delta vit ici et non dans une vue : une carte déplacée par quelqu'un d'autre doit
 * apparaître aussi dans la table et la chronologie. La fiche d'une carte s'ouvre ici, par-dessus
 * n'importe quelle vue (route `<vue>/carte/:cardId`).
 */
export function ActionsLayout({ boardId, titleRef }: ActionsLayoutProps) {
  const boardQuery = useBoard(boardId);
  useBoardSync(boardId);
  const snapshot = boardQuery.data;
  const [dialog, setDialog] = useState<LayoutDialog | null>(null);
  // `useMemo` : `BoardPrefsProvider` élague sa préférence quand cette liste change ; une liste
  // neuve à chaque rendu relancerait son effet à chaque frappe de la recherche.
  const columnIds = useMemo(() => snapshot?.columns.map((column) => column._id), [snapshot?.columns]);

  return (
    // `onOpenColumnVisibility` sans `useCallback` : le fournisseur la lit par une ref.
    <BoardPrefsProvider boardId={boardId} columnIds={columnIds} onOpenColumnVisibility={() => setDialog("columns")}>
      <ActionsLayoutContent boardId={boardId} boardQuery={boardQuery} titleRef={titleRef} dialog={dialog} setDialog={setDialog} />
    </BoardPrefsProvider>
  );
}

/** Entrées de « Colonnes affichées » : les colonnes dans l'ordre du tableau, avec leurs cartes. */
function columnEntries(snapshot: BoardSnapshot, t: (key: string, options?: Record<string, unknown>) => string): ColumnVisibilityEntry[] {
  const counts = new Map<string, number>();
  for (const card of snapshot.cards) counts.set(card.columnId, (counts.get(card.columnId) ?? 0) + 1);
  return sortByRank(snapshot.columns).map((column) => ({
    id: column._id,
    label: resolveColumnTitle(column, (key, fallback) => t(key, { defaultValue: fallback })),
    detail: t("column.cardCount", { count: counts.get(column._id) ?? 0 }),
  }));
}

interface ActionsLayoutContentProps extends ActionsLayoutProps {
  boardQuery: ReturnType<typeof useBoard>;
  dialog: LayoutDialog | null;
  setDialog: (dialog: LayoutDialog | null) => void;
}

function ActionsLayoutContent({ boardId, boardQuery, titleRef, dialog, setDialog }: ActionsLayoutContentProps) {
  const { t } = useTranslation("modules/kanban");
  const snapshot = boardQuery.data;
  const capabilities = snapshot?.capabilities;
  const search = useBoardSearch();
  const { updateCard, archiveCard } = useBoardMutations(boardId);
  const [announcement, announce] = useAnnouncer();
  const navigate = useNavigate();
  const currentUserId = useCurrentUserId();

  /*
   * Vue et carte ouvertes, lues sur l'ADRESSE : la vue se partage, se recharge et se retrouve au
   * bouton « Précédent ». `<vue>/carte/:cardId` garde la vue (la fiche s'ouvre par-dessus).
   */
  const match = useMatch(`${KANBAN_ACTIONS_PATH}/*`);
  const { view: viewId, cardId: openedCardId } = parseActionsPath(match?.params["*"]);
  const view = actionsViewById(viewId);
  // Jalons : tableau relié d'un PROJET seulement (une organisation n'en a pas).
  const milestonesAvailable = snapshot !== undefined && hasMilestones({ source: snapshot.capabilities.source, parentType: snapshot.board.parentType });

  /*
   * MASQUAGE LOCAL des colonnes du Tableau (préférence du poste), élagué des colonnes disparues :
   * l'indicateur ne compte que des colonnes qui existent.
   */
  const prefs = useBoardPrefs();
  // `useMemo` : le tableau en dérive l'ordre affiché des colonnes ; une liste neuve à chaque
  // rendu referait cet ordre, et rendrait toutes les colonnes, à chaque frappe de la recherche.
  const hiddenColumnIds = useMemo(
    () => (snapshot === undefined ? [] : pruneHiddenColumns(prefs.hiddenColumnIds, snapshot.columns.map((column) => column._id))),
    [prefs.hiddenColumnIds, snapshot],
  );
  const hiddenCount = hiddenColumnIds.length;

  /*
   * Masquer une colonne fait disparaître son menu « ⋯ », focus compris : il passe alors à
   * l'indicateur « N colonnes masquées · Tout afficher » ; « Tout afficher » fait disparaître
   * l'indicateur, et le focus revient au bouton « Colonnes affichées ». Seulement si le focus est
   * perdu. Repli : le titre de la page.
   */
  const noticeRef = useRef<HTMLButtonElement>(null);
  const columnsButtonRef = useRef<HTMLButtonElement>(null);
  const findFocusAfterToggle = useCallback(() => noticeRef.current ?? columnsButtonRef.current ?? titleRef.current, [titleRef]);
  const armFocusAfterToggle = useFocusAfterChange(hiddenCount, findFocusAfterToggle);

  /*
   * `mutate` / `mutateAsync` sont stables d'un rendu à l'autre, contrairement à l'objet de
   * mutation : ce sont eux qu'on met en dépendance, sinon les rappels changeraient d'identité à
   * chaque rendu et casseraient la mémoïsation des colonnes et des cartes.
   */
  const updateCardAsync = updateCard.mutateAsync;
  const archiveCardMutate = archiveCard.mutate;
  const toggleColumn = prefs.toggleColumn;
  const columns = snapshot?.columns;

  // `useCallback` : la fonction descend jusqu'aux colonnes mémoïsées du Tableau.
  const handleHideColumn = useCallback(
    (columnId: string) => {
      const column = columns?.find((entry) => entry._id === columnId);
      armFocusAfterToggle();
      if (column) announce(t("columnVisibility.hiddenAnnouncement", { title: resolveColumnTitle(column, (key, fallback) => t(key, { defaultValue: fallback })) }));
      toggleColumn(columnId);
    },
    [announce, armFocusAfterToggle, columns, t, toggleColumn],
  );

  function showAllColumns() {
    armFocusAfterToggle();
    announce(t("columnVisibility.shownAllAnnouncement"));
    prefs.showAllColumns();
  }

  /*
   * Archiver, depuis la colonne de fin comme depuis la fiche : la carte part par la mutation
   * optimiste, un refus est annoncé par la notification du hook (puis annulé). La RÉUSSITE se dit
   * aussi : aucun écran ne restaure une carte archivée, et un retrait silencieux laissait croire,
   * au lecteur d'écran surtout, que rien n'avait eu lieu. `useCallback` : la fonction descend
   * jusqu'à chaque carte mémoïsée.
   */
  const handleArchiveCard = useCallback(
    (cardId: string) => {
      archiveCardMutate({ cardId }, { onSuccess: () => toast.success(t("toast.cardArchived")) });
    },
    [archiveCardMutate, t],
  );

  const openMilestones = () => setDialog("milestones");

  /*
   * `progress` parcourt TOUTES les cartes (un projet en porte parfois un millier) : on ne la
   * refait que quand l'instantané change, pas à chaque frappe dans la recherche.
   */
  const progress = useMemo(() => (snapshot ? boardProgress(snapshot) : null), [snapshot]);

  async function copyLink() {
    const url = window.location.href;
    try {
      // `navigator.clipboard` n'existe qu'en contexte sécurisé : sans lui, on le dit et on montre
      // l'adresse, plutôt que d'échouer en silence.
      if (!navigator.clipboard) throw new Error("clipboard unavailable");
      await navigator.clipboard.writeText(url);
      toast.success(t("board.share.copied"));
    } catch {
      toast.error(t("board.share.failed"), { description: url });
    }
  }

  /*
   * Le menu « ⋯ » range ce que le sélecteur ne montre pas : les autres vues (cochée : la vue
   * courante), la gestion des jalons d'un projet, le lien à partager.
   */
  const viewItems: ActionMenuItem[] = menuViews(snapshot?.board.parentType).map((entry) => ({
    key: `view-${entry.id}`,
    icon: entry.icon,
    label: t(entry.labelKey),
    current: entry.id === viewId,
    onSelect: () => void navigate(actionsViewPath(entry.id)),
  }));
  const boardItems: ActionMenuItem[] = [
    // La GESTION des jalons, distincte de la VUE Jalons : autre nom, autre icône. Deux items
    // « Jalons » au même drapeau ne disaient pas lequel navigue et lequel ouvre la boîte.
    ...(milestonesAvailable ? [{ key: "milestones", icon: Settings2, label: t("milestones.trigger"), onSelect: openMilestones }] : []),
    { key: "share", icon: Link2, label: t("board.share.menu"), onSelect: () => void copyLink() },
  ];

  /*
   * Fiche de la carte ouverte, par-dessus la vue courante ; la fermer ramène à CETTE vue. Sans
   * `useCallback` : la fiche n'est pas mémoïsée.
   */
  const closeCard = () => void navigate(actionsViewPath(viewId));
  const openedCard = openedCardId === null || snapshot === undefined ? null : (snapshot.cards.find((card) => card._id === openedCardId) ?? null);

  const outletContext: ActionsOutletContext = {
    boardId,
    snapshot,
    search,
    view: viewId,
    titleRef,
    hiddenColumnIds,
    hideColumn: handleHideColumn,
    archiveCard: handleArchiveCard,
    openMilestones: milestonesAvailable ? openMilestones : undefined,
  };

  return (
    <div className="flex flex-col md:min-h-0 md:flex-1">
      <div className="flex shrink-0 flex-col gap-3 pb-3">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
          {progress !== null && progress.total > 0 ? (
            <div className="flex items-center gap-3">
              <Progress value={progress.percent} aria-label={t("boardHeader.progressLabel")} className="h-1.5 w-32 shrink-0" />
              <p className="text-sm text-muted-foreground tabular-nums">{t("boardHeader.progress", { done: progress.done, total: progress.total, percent: progress.percent })}</p>
            </div>
          ) : null}
          <div className="ml-auto flex min-w-0 items-center gap-2">
            <ViewSwitcher current={viewId} />
            <ActionMenu label={t("board.menu.label")} triggerVariant="outline" sections={[
              { key: "views", label: t("board.menu.viewsSection"), items: viewItems },
              { key: "board", items: boardItems },
            ]} />
          </div>
        </div>

        {snapshot === undefined ? null : view.unavailable.filter !== undefined ? (
          // La vue d'ensemble résume le tableau ENTIER : la barre de filtres y laisse la place à la
          // phrase qui le dit, plutôt que de filtrer un avancement qui ne mesurerait plus rien.
          <p className="text-sm text-muted-foreground">{t(view.unavailable.filter)}</p>
        ) : (
          /* Sous 1024 px, la barre de filtres prend toute la ligne ; « Grouper / Trier » et les
             commandes de colonnes passent dessous. Au-delà, ils se rangent à sa droite. */
          <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
            <BoardFilterBar snapshot={snapshot} search={search} className="min-w-0 basis-full lg:basis-0 lg:flex-1" />
            <div className="flex flex-wrap items-center gap-2">
              <BoardViewControls view={view} search={search} />
              {view.hidesColumns === true && snapshot.columns.length > 0 ? (
                <>
                  {hiddenCount > 0 ? (
                    // Masquer une colonne ne doit pas la faire oublier : la vue dit combien elle en
                    // cache et offre de tout réafficher.
                    <button
                      ref={noticeRef}
                      type="button"
                      onClick={showAllColumns}
                      className={cn(
                        "inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-md border border-dashed border-[var(--ck-border-strong)] px-3",
                        "text-sm text-muted-foreground pointer-coarse:min-h-11",
                        "transition-colors duration-[var(--ck-duration-out)] ease-in hover:bg-muted hover:text-foreground",
                        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                      )}
                    >
                      <Eye aria-hidden className="size-4 shrink-0" />
                      {t("columnVisibility.hiddenCount", { count: hiddenCount })}
                    </button>
                  ) : null}
                  <Button ref={columnsButtonRef} variant="outline" size="sm" className="pointer-coarse:min-h-11" onClick={prefs.openColumnVisibility}>
                    <Columns3 aria-hidden />
                    {t("columnVisibility.menu")}
                  </Button>
                </>
              ) : null}
            </div>
          </div>
        )}
      </div>

      {boardQuery.isError ? (
        // L'échec du chargement remplace la vue : c'est le seul écran d'erreur du tableau, il
        // nomme la cause et offre de réessayer.
        <FailureNotice
          announce="alert"
          error={boardQuery.error}
          action={
            <Button variant="outline" size="sm" onClick={() => void boardQuery.refetch()}>
              <RefreshCw aria-hidden />
              {t("common.retry")}
            </Button>
          }
        />
      ) : (
        /* Dès 768 px, la page est bornée à l'écran : le Tableau fait défiler ses colonnes en
           interne, les autres vues défilent ici. */
        <div className="flex min-h-0 flex-1 flex-col md:overflow-y-auto">
          <Outlet context={outletContext} />
        </div>
      )}

      {/* `fallback={null}` : les boîtes sont des sur-écrans, un squelette le temps du chargement
          ferait clignoter la page. */}
      {dialog === "columns" && snapshot !== undefined ? (
        <Suspense fallback={null}>
          <ColumnVisibilityDialog open entries={columnEntries(snapshot, t)} onClose={() => setDialog(null)} />
        </Suspense>
      ) : null}

      {dialog === "milestones" && milestonesAvailable ? (
        <Suspense fallback={null}>
          <MilestonesDialog boardId={boardId} onClose={() => setDialog(null)} />
        </Suspense>
      ) : null}

      {/* Pas de `key` par carte : passer d'une carte à l'autre garde l'instance, qui se
          resynchronise elle-même (`CardDialog`). */}
      {openedCardId !== null && snapshot !== undefined && capabilities !== undefined ? (
        <Suspense fallback={null}>
          <CardDialog
            card={openedCard}
            board={snapshot.board}
            columns={snapshot.columns}
            members={snapshot.members}
            capabilities={capabilities}
            milestones={snapshot.milestones}
            currentUserId={currentUserId}
            isLoading={boardQuery.isFetching}
            onClose={closeCard}
            onSave={(patch) => updateCardAsync({ cardId: openedCardId, ...patch })}
            onArchive={capabilities.canArchiveCards ? () => handleArchiveCard(openedCardId) : undefined}
            // Le focus revient au lien de la carte dans la vue, l'arrêt qui l'ouvre au clavier ; à
            // celui de la page quand la carte n'y est plus (archivée, ou terminée dans la vue Jalons).
            returnFocus={() => cardLinkIn(document, openedCardId) ?? titleRef.current}
          />
        </Suspense>
      ) : null}

      {/* Région vivante de la mise en page, MONTÉE dès le premier rendu et vide. Le tableau et le
          glisser ont les leurs. */}
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </div>
  );
}
