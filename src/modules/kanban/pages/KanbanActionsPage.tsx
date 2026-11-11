import { KanbanPageFrame } from "../components/KanbanPageFrame";
import { ActionsLayout } from "../components/actions/ActionsLayout";
import { KanbanBoardPage } from "../components/board/KanbanBoardPage";
import { boardTypeOf } from "../components/home/boardTypes";
import "../i18n";

const TYPE = boardTypeOf("actions");

/**
 * Route `/kanban/actions` et ses vues (`routes.tsx`) : le tableau des actions de l'élément
 * porteur. La page est le PARENT des routes de vue ; sa mise en page rend la vue courante dans son
 * `<Outlet>`. Sans pied de site : le tableau occupe la hauteur (RFC §6.3).
 */
export default function KanbanActionsPage() {
  return (
    <KanbanPageFrame board>
      <KanbanBoardPage type={TYPE} renderBoard={({ boardId, titleRef }) => <ActionsLayout boardId={boardId} titleRef={titleRef} />} />
    </KanbanPageFrame>
  );
}
