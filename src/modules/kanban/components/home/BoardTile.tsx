import type { ReactNode } from "react";
import { Link } from "react-router";
import { ArrowRight } from "lucide-react";
import { useT } from "@/hooks/useT";
import { cn } from "@/lib/utils";
import { KANBAN_HOME_PATH } from "@/modules/kanban/lib/kanbanPaths";
import type { KanbanBoardType } from "./boardTypes";

interface BoardTileProps {
  type: KanbanBoardType;
  /** Faux quand le serveur a refusé l'accès : la tuile reste lisible mais n'ouvre rien. */
  enabled: boolean;
  /** Pied de tuile : les chiffres propres au type de kanban, dans un `BoardTileFooter`. */
  footer?: ReactNode;
}

/**
 * Tuile d'un kanban sur `/kanban`. Toute la tuile est le lien (cible tactile large) ; refusée,
 * elle devient un bloc inerte annoncé comme tel, plutôt qu'un lien vers un second refus.
 */
export function BoardTile({ type, enabled, footer }: BoardTileProps) {
  const t = useT("modules/kanban");
  const Icon = type.icon;
  const body = (
    <>
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold leading-tight">{String(t(type.titleKey))}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{String(t(type.descriptionKey))}</p>
        </div>
        {enabled && (
          <ArrowRight
            className="mt-1 size-5 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-primary motion-reduce:transition-none"
            aria-hidden
          />
        )}
      </div>
      {footer}
    </>
  );
  // `h-full` : les tuiles d'une même rangée prennent la même hauteur, leurs pieds s'alignent.
  const shell = "flex h-full flex-col gap-4 rounded-xl border border-border bg-card p-5 text-card-foreground shadow-sm";

  if (!enabled) {
    return (
      <div className={cn(shell, "opacity-60")} aria-disabled="true">
        {body}
      </div>
    );
  }
  return (
    <Link
      to={`${KANBAN_HOME_PATH}/${type.path}`}
      className={cn(
        shell,
        "group transition-colors duration-200 hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      )}
    >
      {body}
    </Link>
  );
}

/**
 * Pied d'une tuile : la zone des chiffres, détachée de la présentation par un filet. Il suit la
 * présentation au lieu de se caler en bas : les pieds n'ont pas la même hauteur d'un kanban à
 * l'autre, et calés en bas, leurs filets ne s'aligneraient plus d'une tuile à sa voisine.
 */
export function BoardTileFooter({ children }: { children: ReactNode }) {
  return <div className="border-t border-border pt-4">{children}</div>;
}
