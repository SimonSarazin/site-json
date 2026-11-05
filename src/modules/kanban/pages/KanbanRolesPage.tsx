import { KanbanPageFrame } from "../components/KanbanPageFrame";
import { KanbanBoardPage } from "../components/board/KanbanBoardPage";
import { boardTypeOf } from "../components/home/boardTypes";
import { RolesView } from "../components/roles/RolesView";
import "../i18n";

const TYPE = boardTypeOf("roles");

/**
 * Route `/kanban/roles` : le kanban des rôles de l'élément porteur. Sans pied de site : le
 * tableau occupe la hauteur (RFC §6.3).
 */
export default function KanbanRolesPage() {
  return (
    <KanbanPageFrame board>
      <KanbanBoardPage type={TYPE} renderBoard={({ boardId, titleRef }) => <RolesView boardId={boardId} titleRef={titleRef} />} />
    </KanbanPageFrame>
  );
}
