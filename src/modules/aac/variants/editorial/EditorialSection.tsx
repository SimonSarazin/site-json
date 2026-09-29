import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Bloc de la fiche « editorial » : carte bordée, titre en police d'affichage, ancre `id` facultative.
 * `demo` : bloc de démonstration, titre en rouge.
 */
export function EditorialSection({
  id,
  title,
  kicker,
  icon,
  demo = false,
  className,
  children,
}: {
  id?: string;
  title: ReactNode;
  kicker?: string;
  icon?: ReactNode;
  demo?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className={cn("scroll-mt-24 rounded-xl border border-border bg-card p-6", className)}>
      {kicker && (
        <p className="text-xs font-medium tracking-widest text-muted-foreground uppercase">{kicker}</p>
      )}
      <h2 className={cn("flex items-center gap-2 font-display text-xl", demo && "text-destructive")}>
        {icon}
        {title}
      </h2>
      {children}
    </section>
  );
}
