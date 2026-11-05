import { useCallback, useMemo, useRef } from "react";
import { Flag, FlagOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { BoardColumnsSkeleton } from "@/modules/kanban/components/board/BoardColumnsSkeleton";
import type { CardComposerSubmit } from "@/modules/kanban/components/board/CardComposer";
import type { ColumnDecoration } from "@/modules/kanban/components/board/KanbanColumn";
import { KanbanBoard } from "@/modules/kanban/components/board/KanbanBoard";
import type { CardMoveRequest } from "@/modules/kanban/components/board/kanbanDnd";
import { useFocusAfterChange } from "@/modules/kanban/components/board/useFocusAfterChange";
import type { ActionMenuItem } from "@/modules/kanban/components/ui/ActionMenu";
import { useBoardMutations } from "@/modules/kanban/hooks/useBoardMutations";
import { useInterfaceLanguage } from "@/modules/kanban/hooks/useInterfaceLanguage";
import { useMilestoneMutations } from "@/modules/kanban/hooks/useMilestones";
import { dateZoneFor, hasMilestones } from "@/modules/kanban/lib/boardSource";
import { dateRangeLabel } from "@/modules/kanban/lib/dates";
import { actionsViewPath } from "@/modules/kanban/lib/kanbanPaths";
import type { Card, Milestone } from "@/modules/kanban/types";
import { useActionsOutlet } from "./actionsOutlet";
import { buildMilestoneBoard, milestoneIdOfColumn, milestoneViewSnapshot, newCardStatusColumnId, NO_MILESTONE_COLUMN_ID } from "./milestonesView";

/** Le déplacement de colonnes n'existe pas ici (ce sont des jalons). */
function ignoreColumnMove() {}

/**
 * Vue Jalons (parité avec Kanban gestion) : les cartes en cours rangées par jalon ouvert, et le
 * glisser d'un jalon à l'autre. Reprise de co-kanban (`pages/board/MilestonesView.tsx`).
 *
 * Toute la logique (colonnes, cartes, colonne de chaque carte) vit dans `milestonesView.ts`, pur
 * et testé. Le tableau est CELUI du Tableau : mêmes cartes, même glisser-déposer (clavier et
 * annonces compris), même « Déplacer vers… ». Seule change l'écriture d'un dépôt :
 * `card/update {milestoneId}` au lieu de `card/move`, par la mutation optimiste existante.
 *
 * `export default` : chargée à la demande (`routes.tsx`).
 */
export default function MilestonesView() {
  const { t } = useTranslation("modules/kanban");
  const locale = useInterfaceLanguage();
  const { boardId, snapshot, search, openMilestones } = useActionsOutlet();
  const { createCard, updateCard } = useBoardMutations(boardId);
  const { update: updateMilestone } = useMilestoneMutations(boardId);

  const noMilestoneTitle = t("views.milestones.noMilestone");
  const board = useMemo(() => (snapshot ? buildMilestoneBoard(snapshot, noMilestoneTitle) : null), [snapshot, noMilestoneTitle]);
  const viewSnapshot = useMemo(() => (snapshot && board ? milestoneViewSnapshot(snapshot, board) : null), [snapshot, board]);
  // Stable tant que les cartes ne changent pas de jalon : l'ordre affiché en dépend.
  const cardColumnOf = useCallback((card: Card) => board?.columnOf.get(card._id) ?? NO_MILESTONE_COLUMN_ID, [board]);

  /*
   * `mutate` / `mutateAsync` sont stables, l'objet de mutation non : ce sont eux qui vont en
   * dépendance, sinon les rappels changeraient à chaque rendu et casseraient la mémoïsation des
   * colonnes et des cartes.
   */
  const updateCardMutate = updateCard.mutate;
  const createCardAsync = createCard.mutateAsync;
  const updateMilestoneMutate = updateMilestone.mutate;

  /** Dépôt (ou « Déplacer vers… ») sur un autre jalon : seul le jalon s'écrit. */
  const handleMoveCard = useCallback(
    (intent: CardMoveRequest) => {
      const milestoneId = milestoneIdOfColumn(intent.columnId);
      if (milestoneId === undefined) return;
      updateCardMutate({ cardId: intent.cardId, milestoneId });
    },
    [updateCardMutate],
  );

  /*
   * Carte créée dans une colonne de jalon : statut « À faire », rattachée au jalon de la colonne
   * (la création de gestion). Le rejet REMONTE au composeur, qui garde alors la saisie.
   */
  const statusColumnId = snapshot ? newCardStatusColumnId(snapshot.columns) : undefined;
  const handleCreateCard = useCallback(
    ({ columnId, title }: CardComposerSubmit) => {
      // Le registre du SDK exige la colonne. Sans instantané il n'y a pas de colonne de statut, mais
      // pas de composeur non plus : ce rejet ne sert qu'à tenir le contrat.
      if (statusColumnId === undefined) return Promise.reject(new Error("Tableau non chargé : aucune colonne de statut."));
      const milestoneId = milestoneIdOfColumn(columnId);
      return createCardAsync({ columnId: statusColumnId, title, ...(milestoneId ? { milestoneId } : {}) });
    },
    [createCardAsync, statusColumnId],
  );

  /*
   * CLORE depuis le menu de la colonne : la colonne disparaît (jalons ouverts seulement), avec le
   * bouton qui avait le focus. Le focus passe au menu de la première colonne, et la notification
   * dit comment rouvrir le jalon.
   */
  const boardRegionRef = useRef<HTMLDivElement>(null);
  const findFirstColumnMenu = useCallback(() => boardRegionRef.current?.querySelector<HTMLButtonElement>('section header button[aria-haspopup="menu"]') ?? null, []);
  const focusAfterClose = useFocusAfterChange(board?.columns.length ?? 0, findFirstColumnMenu);
  const closeMilestone = useCallback(
    (milestone: Milestone) => {
      focusAfterClose();
      updateMilestoneMutate({ milestoneId: milestone.milestoneId, status: "close" }, { onSuccess: () => toast.success(t("views.milestones.closed", { name: milestone.name })) });
    },
    [focusAfterClose, t, updateMilestoneMutate],
  );

  const canManageMilestones = snapshot?.capabilities.canManageMilestones === true;
  // Jalons d'un projet Communecter : instants saisis en heure locale par gestion, lus dans le même
  // fuseau que la boîte des jalons.
  const zone = dateZoneFor(snapshot?.capabilities.source ?? "communecter");
  const decorations = useMemo(() => {
    const map = new Map<string, ColumnDecoration>();
    for (const entry of board?.meta ?? []) {
      const done = entry.doneCount > 0 ? t("views.milestones.doneCount", { count: entry.doneCount }) : null;
      if (entry.milestone === null) {
        map.set(entry.columnId, { icon: FlagOff, subtitle: [t("views.milestones.toSchedule"), done].filter(Boolean).join(" · ") });
        continue;
      }
      const milestone = entry.milestone;
      const period = dateRangeLabel(milestone.startDate, milestone.endDate, locale, (key, values) => t(key, values), zone);
      const menuItems: ActionMenuItem[] | undefined = canManageMilestones
        ? [{ key: "close-milestone", icon: FlagOff, label: t("views.milestones.closeMilestone"), onSelect: () => closeMilestone(milestone) }]
        : undefined;
      map.set(entry.columnId, { icon: Flag, subtitle: [period, done].filter(Boolean).join(" · "), menuItems });
    }
    return map;
  }, [board, canManageMilestones, closeMilestone, locale, t, zone]);

  if (snapshot === undefined || viewSnapshot === null || board === null) return <BoardColumnsSkeleton columns={3} scroll className="pb-4" />;

  if (!hasMilestones({ source: snapshot.capabilities.source, parentType: snapshot.board.parentType })) {
    // Adresse tapée à la main sur le tableau d'une ORGANISATION (sans jalons) : la vue le dit et
    // ramène au Tableau.
    return (
      <div role="status" className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-6 py-12 text-center">
        <Flag aria-hidden className="size-6 text-muted-foreground" />
        <p className="text-sm font-medium text-foreground">{t("views.milestones.unavailableTitle")}</p>
        <p className="max-w-sm text-sm text-muted-foreground">{t("views.milestones.unavailableHint")}</p>
        <Button asChild variant="outline" size="sm">
          <Link to={actionsViewPath("kanban")}>{t("views.milestones.backToBoard")}</Link>
        </Button>
      </div>
    );
  }

  const canEditCards = snapshot.capabilities.canEditCards;
  return (
    <div ref={boardRegionRef} className="flex flex-col md:min-h-0 md:flex-1">
      <p className="shrink-0 pb-2 text-sm text-muted-foreground">
        {canEditCards ? t("views.milestones.intro") : t("views.milestones.introReadOnly")}
        {board.hiddenClosedCount > 0 ? <> {t("views.milestones.hiddenClosed", { count: board.hiddenClosedCount })}</> : null}
      </p>
      <KanbanBoard
        // Un autre tableau repart d'un état neuf (fenêtres, aperçus, annonces).
        key={snapshot.board._id}
        snapshot={viewSnapshot}
        criteria={search.criteria}
        cardColumnOf={cardColumnOf}
        columnDecorations={decorations}
        moveTarget="milestone"
        view="milestones"
        onMoveCard={handleMoveCard}
        onMoveColumn={ignoreColumnMove}
        onCreateCard={canEditCards ? handleCreateCard : undefined}
        addColumn={canManageMilestones && openMilestones ? { label: t("views.milestones.addMilestone"), onClick: openMilestones } : undefined}
        className="min-h-0 flex-1 pt-1 pb-4"
      />
    </div>
  );
}
