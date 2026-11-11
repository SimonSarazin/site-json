import { useContext, type ReactNode } from "react";
import { Lock, RotateCcw, SquareDashed, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useT } from "@/hooks/useT";
import { LoginPrompt } from "@/modules/auth/components/LoginPrompt";
import { AuthModalContext } from "@/modules/auth/context/AuthModalContext";
import { kanbanFailureKind } from "@/modules/kanban/lib/kanbanErrors";
import { kanbanAccessState, type KanbanAccessState } from "@/modules/kanban/lib/accessState";
import type { ContextBoard } from "@/modules/kanban/hooks/useContextBoard";
import { useCurrentUserId, useKanbanHydrated } from "@/modules/kanban/hooks/useKanbanSession";

interface KanbanAccessNoticeProps {
  board: ContextBoard;
  className?: string;
}

/**
 * Ce que voit un visiteur qui ne peut pas (encore) ouvrir les kanbans : invitation à se
 * connecter, refus réservé aux membres, échec de chargement avec « Réessayer », ou site sans
 * kanban. Rien quand l'accès est ouvert ou en cours de résolution (la page montre alors son
 * squelette). Partagé par l'écran de liste et par les tableaux.
 */
export function KanbanAccessNotice({ board, className }: KanbanAccessNoticeProps) {
  const t = useT("modules/kanban");
  const hydrated = useKanbanHydrated();
  const userId = useCurrentUserId();
  const loginModal = useContext(AuthModalContext);
  const state: KanbanAccessState = kanbanAccessState({ hydrated, userId, parent: board.parent, error: board.query.error });
  const name = board.parentName ?? String(t("home.thisCollective"));

  if (state === "anonymous") {
    const message = String(t("home.login", undefined, { name }));
    // `LoginPrompt` ouvre la modale globale, qui n'existe que sous `AuthModalProvider` : ailleurs
    // (un test, un hôte sans elle), le message seul plutôt qu'une erreur.
    return loginModal ? (
      <LoginPrompt message={message} variant="inline" className={className} />
    ) : (
      <p className={cn("text-sm text-muted-foreground", className)}>{message}</p>
    );
  }
  if (state === "notMember") {
    return (
      <Notice className={className} icon={<Lock className="size-5" aria-hidden />} title={String(t("home.notMember.title"))}>
        {String(t("home.notMember.body", undefined, { name }))}
      </Notice>
    );
  }
  if (state === "unavailable") {
    return (
      <Notice className={className} icon={<SquareDashed className="size-5" aria-hidden />} title={String(t("home.unavailable.title"))}>
        {String(t("home.unavailable.body"))}
      </Notice>
    );
  }
  if (state === "failed") {
    const kind = kanbanFailureKind(board.query.error);
    return (
      <Notice
        className={className}
        tone="error"
        icon={<TriangleAlert className="size-5" aria-hidden />}
        title={String(t(`errorState.title.${kind}`))}
        action={
          <Button variant="outline" size="sm" onClick={() => void board.query.refetch()} disabled={board.query.isFetching}>
            <RotateCcw className="size-4" aria-hidden />
            {String(t("common.retry"))}
          </Button>
        }
      >
        {String(t(`errorState.hint.${kind}`))}
      </Notice>
    );
  }
  return null;
}

interface NoticeProps {
  icon: ReactNode;
  title: string;
  children: ReactNode;
  action?: ReactNode;
  tone?: "neutral" | "error";
  className?: string;
}

function Notice({ icon, title, children, action, tone = "neutral", className }: NoticeProps) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "flex flex-col gap-3 rounded-lg border px-4 py-3 sm:flex-row sm:items-start",
        tone === "error" ? "border-destructive/40 bg-destructive/5" : "border-border bg-muted/40",
        className,
      )}
    >
      <span className={tone === "error" ? "mt-0.5 text-destructive" : "mt-0.5 text-muted-foreground"}>{icon}</span>
      <div className="min-w-0 flex-1 space-y-1">
        <p className="font-medium text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground">{children}</p>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
