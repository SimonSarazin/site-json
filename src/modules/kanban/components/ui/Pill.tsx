import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Teintes des pastilles, branchées sur les jetons du site. Le texte reste en encre du site
 * (`foreground`) sur une teinte légère : le contraste ne dépend pas de la palette du site.
 */
const TONES = {
  neutral: "bg-muted text-muted-foreground",
  info: "bg-primary/15 text-foreground",
  warn: "bg-warning/25 text-foreground",
  // Le vert de réussite du module (`styles.css`), en teinte : l'encre reste celle du texte.
  success: "bg-[var(--ck-success-ink)]/15 text-foreground",
  danger: "bg-destructive/15 text-foreground",
  brand: "bg-primary text-primary-foreground",
} as const;

export type PillTone = keyof typeof TONES;

/**
 * Pastille de statut (« Admin », « En attente », « Attribuer ») : TOUJOURS un mot et un
 * pictogramme, jamais la couleur seule (reprise de la `Pill` de co-kanban, taille `xs`).
 */
export function Pill({ tone, icon: Icon, children, className }: { tone: PillTone; icon?: LucideIcon; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex h-5 items-center gap-1 rounded-full px-2 text-[0.6875rem] font-medium leading-none whitespace-nowrap", TONES[tone], className)}>
      {Icon ? <Icon aria-hidden className="size-3 shrink-0" /> : null}
      {children}
    </span>
  );
}
