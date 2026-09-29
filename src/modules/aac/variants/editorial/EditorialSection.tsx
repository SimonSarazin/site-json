import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Bloc de la fiche « editorial » : carte bordée, titre en police d'affichage, ancre `id` facultative. */
export function EditorialSection({
  id,
  title,
  kicker,
  icon,
  className,
  children,
}: {
  id?: string;
  title: ReactNode;
  kicker?: string;
  icon?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className={cn("scroll-mt-24 rounded-xl border border-border bg-card p-6", className)}>
      {kicker && (
        <p className="text-xs font-medium tracking-widest text-muted-foreground uppercase">{kicker}</p>
      )}
      <h2 className="flex items-center gap-2 font-display text-xl">
        {icon}
        {title}
      </h2>
      {children}
    </section>
  );
}
