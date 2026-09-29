import type { ReactNode } from "react";

/** Bloc de la fiche : titre, surtitre facultatif et ancre `id` (cible du sommaire). */
export function CommunSection({
    id,
    title,
    kicker,
    children,
}: {
    id: string;
    title: string;
    kicker?: string;
    children: ReactNode;
}) {
    return (
        <section id={id} className="scroll-mt-24">
            <div className="mb-6 flex items-end justify-between gap-4 flex-wrap">
                <h2 className="text-2xl sm:text-3xl font-display font-bold tracking-tight">{title}</h2>
                {kicker && (
                    <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                        {kicker}
                    </span>
                )}
            </div>
            {children}
        </section>
    );
}
