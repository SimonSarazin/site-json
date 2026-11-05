import type { ReactNode } from "react";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { cn } from "@/lib/utils";
import { KanbanSessionProvider } from "./KanbanSessionProvider";
import "../styles.css";

interface KanbanPageFrameProps {
  children: ReactNode;
  /**
   * Page d'un tableau : sans pied de site, et bornée à la hauteur de l'écran dès 768 px, pour
   * que les colonnes défilent chacune en interne et la rangée en largeur (RFC §6.3).
   */
  board?: boolean;
  className?: string;
}

/**
 * Chrome commun des pages du module. Les routes de module sont montées sous `RootLayout`,
 * PAS sous `SiteRenderer` : une page de module rend elle-même l'en-tête du site (même patron
 * que `AacPage` / `AdminPage`), sinon le menu disparaît. Pose aussi la session du module.
 */
export function KanbanPageFrame({ children, board = false, className }: KanbanPageFrameProps) {
  return (
    <KanbanSessionProvider>
      {/* `kanban-module` : porte la géométrie du kanban (`styles.css`), sans rien faire fuir. */}
      <div className={cn("kanban-module flex min-h-dvh flex-col bg-background", board && "md:h-dvh")}>
        <SiteHeader />
        <main className={cn("flex-1", board && "flex min-h-0 flex-col", className)}>{children}</main>
        {!board && <SiteFooter />}
      </div>
    </KanbanSessionProvider>
  );
}
