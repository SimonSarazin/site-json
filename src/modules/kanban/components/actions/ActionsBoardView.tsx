import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { BoardColumnsSkeleton } from "@/modules/kanban/components/board/BoardColumnsSkeleton";
import type { CardComposerSubmit } from "@/modules/kanban/components/board/CardComposer";
import { composerMilestoneId } from "@/modules/kanban/components/board/filterBar";
import { KanbanBoard } from "@/modules/kanban/components/board/KanbanBoard";
import { useBoardMutations } from "@/modules/kanban/hooks/useBoardMutations";
import { useActionsOutlet } from "./actionsOutlet";

/**
 * Vue Tableau (l'index de `/kanban/actions`) : une colonne par statut, le glisser-déposer, la
 * création en ligne et l'archivage depuis « Terminé ». Reprise de co-kanban (`pages/BoardPage.tsx`).
 *
 * L'instantané, la barre de filtres, le masquage des colonnes et la fiche de carte sont ceux de
 * la mise en page (`ActionsLayout`) ; la vue n'écrit que les gestes propres au tableau.
 *
 * `export default` : chargée à la demande (`routes.tsx`), dnd-kit compris.
 */
export default function ActionsBoardView() {
  const { t } = useTranslation("modules/kanban");
  const { boardId, snapshot, search, hiddenColumnIds, hideColumn, archiveCard } = useActionsOutlet();
  const { moveCard, moveColumn, createCard } = useBoardMutations(boardId);

  /*
   * Créer SANS boîte : le titre est saisi dans le composeur en ligne de la colonne. Aucun `try`
   * ici : le rejet REMONTE au composeur, qui en a besoin pour conserver la saisie.
   *
   * Filtre sur UN jalon : la carte y est rattachée, sinon elle disparaîtrait de la vue filtrée dès
   * sa création (cf. `composerMilestoneId`). `useCallback` : la fonction descend jusqu'aux
   * colonnes mémoïsées ; `mutateAsync` est stable, l'objet de mutation non.
   */
  const createCardAsync = createCard.mutateAsync;
  const milestoneFromFilter = snapshot ? composerMilestoneId(search.criteria, snapshot.capabilities.source) : undefined;
  const handleCreateCard = useCallback(
    ({ columnId, title }: CardComposerSubmit) => createCardAsync({ columnId, title, ...(milestoneFromFilter ? { milestoneId: milestoneFromFilter } : {}) }),
    [createCardAsync, milestoneFromFilter],
  );

  if (snapshot === undefined) return <BoardColumnsSkeleton columns={4} scroll className="pb-4" />;

  if (snapshot.columns.length === 0) {
    return (
      <p role="status" className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
        {t("board.emptyTitle")}
      </p>
    );
  }

  const { capabilities } = snapshot;
  return (
    <KanbanBoard
      // Un autre tableau repart d'un état neuf (fenêtres de cartes, aperçus, annonces).
      key={snapshot.board._id}
      snapshot={snapshot}
      criteria={search.criteria}
      hiddenColumnIds={hiddenColumnIds}
      onHideColumn={hideColumn}
      onMoveCard={moveCard.mutate}
      onMoveColumn={moveColumn.mutate}
      onCreateCard={capabilities.canEditCards ? handleCreateCard : undefined}
      onArchiveCard={capabilities.canArchiveCards ? archiveCard : undefined}
      // Le rembourrage est porté par la LISTE qui défile : posé sur un parent, il serait avalé
      // par le défilement horizontal et la dernière colonne collerait au bord droit.
      className="min-h-0 flex-1 pt-1 pb-4"
    />
  );
}
