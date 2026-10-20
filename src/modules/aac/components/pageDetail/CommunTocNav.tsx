import {ElementType} from "react";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { TocEntriesSkeleton } from "./CommunSkeletons";

interface CommunTocNavProps {
    activeSection: string
    sections: TocSection[]
    /**
     * Vrai tant que la liste des entrées n'est pas arrêtée : « Objectifs » et
     * « Membres du projet » dépendent de la phase du commun, les blocs déclarés des
     * métadonnées du formulaire. Sans cet état, le sommaire s'allongeait après coup.
     */
    isLoading?: boolean
}

export interface TocSection {
    id: string;
    label: string;
    icon: ElementType;
}

export function CommunTocNav({activeSection, sections, isLoading = false}: CommunTocNavProps) {
    useLoadNamespace("modules/aac");
    const t = useT("modules/aac");

    return (
        <aside className="hidden lg:block lg:col-span-3">
            <nav className="sticky top-24 space-y-0.5">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3 px-3">
                    {String(t("detail.toc.navigation"))}
                </p>
                {isLoading ? <TocEntriesSkeleton /> : sections.map((s) => {
                    const active = activeSection === s.id;
                    const Icon = s.icon;
                    return (
                        <a
                            key={s.id}
                            href={`#${s.id}`}
                            className={`flex items-center gap-2.5 px-3 py-2 text-sm font-medium border-l-2 transition-all ${
                                active
                                    ? "text-primary border-primary bg-primary/5"
                                    : "text-muted-foreground border-transparent hover:text-foreground hover:border-border"
                            }`}
                        >
                            <Icon className="size-3.5 shrink-0" />
                            <span className="truncate">{s.label}</span>
                        </a>
                    );
                })}
            </nav>
        </aside>
    );
}