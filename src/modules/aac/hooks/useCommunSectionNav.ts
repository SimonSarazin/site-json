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

/**
 * Montre une section : son contenu revient en haut, et la page y défile si son haut n'est pas dans
 * la moitié haute de l'écran.
 */
export function revealSection(sectionId: string) {
    const section = document.getElementById(sectionId);
    if (!section) return;
    section.scrollTop = 0;
    const { top } = section.getBoundingClientRect();
    if (top < 0 || top > window.innerHeight / 2) section.scrollIntoView({ behavior: "smooth", block: "start" });
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
