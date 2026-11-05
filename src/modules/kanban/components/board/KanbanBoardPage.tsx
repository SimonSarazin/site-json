import { useRef, type ReactNode, type RefObject } from "react";
import { Link } from "react-router";
import { ChevronLeft } from "lucide-react";
import { useT } from "@/hooks/useT";
import { KanbanAccessNotice } from "@/modules/kanban/components/KanbanAccessNotice";
import { useContextBoard } from "@/modules/kanban/hooks/useContextBoard";
import { useCurrentUserId, useKanbanHydrated } from "@/modules/kanban/hooks/useKanbanSession";
import { kanbanAccessState } from "@/modules/kanban/lib/accessState";
import { KANBAN_HOME_PATH } from "@/modules/kanban/lib/kanbanPaths";
import type { KanbanBoardType } from "../home/boardTypes";

/** Ce que reçoit la vue d'un tableau, une fois l'accès ouvert. */
export interface BoardViewContext {
  /** Le tableau relié à l'élément porteur (`board/create`, idempotent). */
  boardId: string;
  /** Le titre de la page, focalisable : il reprend le focus quand la commande qui l'avait disparaît. */
  titleRef: RefObject<HTMLHeadingElement | null>;
}

interface KanbanBoardPageProps {
  type: KanbanBoardType;
  /** La vue du tableau, rendue une fois l'accès ouvert. */
  renderBoard: (context: BoardViewContext) => ReactNode;
}

/**
 * Cadre d'un tableau (`/kanban/actions`, `/kanban/roles`) : retour à la liste, titre, état
 * d'accès, puis la vue du tableau une fois l'accès ouvert.
 */
export function KanbanBoardPage({ type, renderBoard }: KanbanBoardPageProps) {
  const t = useT("modules/kanban");
  const hydrated = useKanbanHydrated();
  const userId = useCurrentUserId();
  const board = useContextBoard();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const state = kanbanAccessState({ hydrated, userId, parent: board.parent, error: board.query.error, loaded: board.query.data !== undefined });
  const boardId = board.query.data?.board._id;

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-[100rem] flex-1 flex-col px-4 py-6 sm:px-[var(--ck-board-padding)]">
      <nav aria-label={String(t("home.breadcrumb"))}>
        <Link
          to={KANBAN_HOME_PATH}
          className="inline-flex min-h-11 items-center gap-1 rounded-md text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronLeft className="size-4" aria-hidden />
          {String(t("home.title"))}
        </Link>
      </nav>
      {/* `tabIndex={-1}` : le titre reprend le focus quand une colonne disparaît avec la commande
          qui l'avait (`RolesBoard`, `ActionsView`). */}
      <h1 ref={titleRef} tabIndex={-1} className="mt-2 text-2xl font-semibold tracking-tight text-foreground focus:outline-none">
        {String(t(type.titleKey))}
        {board.parentName && <span className="font-normal text-muted-foreground"> · {board.parentName}</span>}
      </h1>
      <KanbanAccessNotice board={board} className="mt-6" />
      {state === "open" && boardId !== undefined ? <div className="mt-4 flex min-h-0 flex-1 flex-col">{renderBoard({ boardId, titleRef })}</div> : null}
    </div>
  );
}
