import { useEffect, useMemo, useState } from "react";
import { Sparkles, ListChecks, Handshake, HeartHandshake, Image as ImageIcon } from "lucide-react";

import { useT } from "@/hooks/useT";
import { iconFor } from "../lib/communDetailContent";
import type { TocSection } from "../components/pageDetail/CommunTocNav.tsx";
import type { CommunDetailReadyVM } from "./useCommunDetailController";

/**
 * Sommaire à ancres de la fiche et section active. Opt-in : appelé par une vue sans onglets.
 * Dérivé des mêmes blocs que le rendu.
 */
export function useCommunToc(vm: CommunDetailReadyVM): {
    sections: TocSection[];
    activeSection: string;
    isLoading: boolean;
} {
    const t = useT("modules/aac");

    // Section active ; `null` ⇒ première entrée.
    const [activeSection, setActiveSection] = useState<string | null>(null);

    const showFunding = vm.funding !== null;
    const isProjectPhase =
        vm.objectives.phase === "project" ||
        (vm.objectives.phase === "unresolved" && vm.objectives.isProjectPhase);
    const hasGallery = vm.gallery !== null;
    const prose = vm.prose;

    const SECTIONS: TocSection[] = useMemo(() => [
        ...(showFunding
            ? [{ id: "besoins-financiers", label: String(t("detail.toc.financialNeeds")), icon: Sparkles }]
            : []),
        ...(isProjectPhase
            ? [
                  { id: "objectifs", label: String(t("detail.toc.actions")), icon: ListChecks },
                  { id: "contributeurs", label: String(t("detail.toc.contributors")), icon: HeartHandshake },
              ]
            : []),
        ...(showFunding
            ? [{ id: "cofinanceurs", label: String(t("detail.toc.cofinancers")), icon: Handshake }]
            : []),
        ...prose.map((section) => ({
            id: section.id,
            label: section.title,
            icon: iconFor(section.icon),
        })),
        ...(hasGallery ? [{ id: "galerie", label: String(t("detail.toc.gallery")), icon: ImageIcon }] : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `t` est recréé à chaque rendu (cf. useT).
    ], [showFunding, isProjectPhase, prose, hasGallery]);

    // La vue n'est montée qu'une fois la fiche prête : les ancres existent déjà.
    useEffect(() => {
        const observerCallback: IntersectionObserverCallback = (entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    setActiveSection(entry.target.id);
                }
            });
        };

        const observerOptions: IntersectionObserverInit = {
            rootMargin: "-20% 0px -65% 0px",
            threshold: 0,
        };

        const observer = new IntersectionObserver(observerCallback, observerOptions);

        SECTIONS.forEach((section) => {
            const element = document.getElementById(section.id);
            if (element) {
                observer.observe(element);
            }
        });

        return () => observer.disconnect();
    }, [SECTIONS]);

    return {
        sections: SECTIONS,
        activeSection: activeSection ?? SECTIONS[0]?.id ?? "",
        isLoading: vm.objectives.phase === "unresolved" || vm.isProseLoading,
    };
}
