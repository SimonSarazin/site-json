import { KanbanPageFrame } from "../components/KanbanPageFrame";
import { KanbanHome } from "../components/home/KanbanHome";
import "../i18n";

/** Route `/kanban` : la liste des kanbans de l'élément porteur. Chargée par `lazy` (`routes.tsx`). */
export default function KanbanHomePage() {
  return (
    <KanbanPageFrame>
      <KanbanHome />
    </KanbanPageFrame>
  );
}
