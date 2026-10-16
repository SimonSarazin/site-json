import { createContext, useContext } from "react";
import { flushSync } from "react-dom";

/**
 * Navigation d'un bloc de la fiche vers une autre section, fournie par l'interface :
 * défilement simple par défaut, `tabbedSectionNav` pour une interface à onglets.
 */
export type ShowSection = (sectionId: string) => void;

export function scrollToSection(sectionId: string) {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export const CommunSectionNavContext = createContext<ShowSection>(scrollToSection);

export function useShowSection(): ShowSection {
    return useContext(CommunSectionNavContext);
}

/**
 * Ouvre l'onglet qui porte l'ancre, puis y défile (`tabOf` → `null` : défilement simple).
 * `flushSync` rend l'onglet avant `scrollIntoView` ; à appeler depuis un événement uniquement.
 */
export function tabbedSectionNav<K extends string>(
    setTab: (tab: K) => void,
    tabOf: (sectionId: string) => K | null,
): ShowSection {
    return (sectionId) => {
        const tab = tabOf(sectionId);
        if (tab !== null) flushSync(() => setTab(tab));
        scrollToSection(sectionId);
    };
}
