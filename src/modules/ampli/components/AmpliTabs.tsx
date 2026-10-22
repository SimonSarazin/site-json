import { Link } from "react-router";
import { cn } from "@/lib/utils";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { AMPLI_TABS, ampliTabPath } from "../constants/tabs";

interface AmpliTabsProps {
    /** Slug de l'instance Ampli — préfixe de toutes les URLs d'onglets. */
    slug: string;
    /** Onglet courant, déjà résolu par la page (loader SSR + pathname client). */
    activeTab: string;
}

/**
 * Barre d'onglets de la page Ampli, sous l'en-tête du site.
 *
 * `Link` + `aria-current` plutôt que `NavLink` : l'onglet actif est déjà
 * calculé par `AmpliPage` (loader SSR), ce qui garantit un premier rendu
 * client IDENTIQUE au HTML serveur — `NavLink` compare le pathname au montage
 * et ferait clignoter le soulignement à l'hydratation.
 */
export function AmpliTabs({ slug, activeTab }: AmpliTabsProps) {
    useLoadNamespace("modules/ampli");
    const t = useT("modules/ampli");

    return (
        <nav
            aria-label={String(t("AmpliTabs.label"))}
            // PAS de `sticky` : les en-têtes de site le sont déjà (`sticky top-0
            // z-50` quand `header.sticky`) — une seconde barre collée au même
            // `top-0` passerait DERRIÈRE l'en-tête au défilement.
            className="border-b border-border bg-background"
        >
            {/* `overflow-x-auto` : quatre onglets tiennent en une ligne sur mobile,
                mais les traductions longues (ou une future 5ᵉ entrée) débordent —
                on fait défiler plutôt que de replier sur deux lignes. */}
            <ul className="container mx-auto flex overflow-x-auto px-2 sm:px-4">
                {AMPLI_TABS.map(({ key, labelKey }) => {
                    const isActive = key === activeTab;
                    return (
                        <li key={key} className="flex-1">
                            <Link
                                to={ampliTabPath(slug, key)}
                                aria-current={isActive ? "page" : undefined}
                                className={cn(
                                    "block whitespace-nowrap border-b-2 px-4 py-4 text-center text-sm font-medium transition-colors",
                                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                                    isActive
                                        ? "border-primary text-primary"
                                        : "border-transparent text-muted-foreground hover:text-foreground",
                                )}
                            >
                                {String(t(labelKey))}
                            </Link>
                        </li>
                    );
                })}
            </ul>
        </nav>
    );
}

export default AmpliTabs;
