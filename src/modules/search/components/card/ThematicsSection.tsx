import { useCocolight } from "@/hooks/useCocolight";
import * as LucideIcons from "lucide-react";
import type { ThematicsSectionProps } from "../../schema";
import { ALL_THEME, FILIERE_ICON_MAPPING } from "../../schema";
import "@/modules/search/i18n";
import { useT } from "@/hooks/useT";
import { ComponentType } from "react";

export interface ThematicsSectionWrapperProps {
    id?: string;
    props: ThematicsSectionProps;
}

/**
 * Convertir un nom d'icône FontAwesome en icône Lucide
 */
function resolveLucideIcon(faIconName: string): ComponentType<{ className?: string }> | null {
    // Chercher dans le mapping (normaliser l'espace final)
    const normalizedName = faIconName.trim();
    const lucideName = FILIERE_ICON_MAPPING[normalizedName.toLowerCase()] 
        || FILIERE_ICON_MAPPING[faIconName.toLowerCase()];
    
    if (!lucideName) {
        console.warn(`[ThematicsSection] Icon mapping not found for: ${faIconName}`);
        return LucideIcons.HelpCircle || null;
    }

    // Convertir kebab-case en PascalCase (ex: "map-pin" → "MapPin")
    const pascalName = lucideName
        .split("-")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join("");
    return (LucideIcons as unknown as Record<string, ComponentType<{ className?: string }>>)[pascalName] ?? null;
}

/**
 * ThematicsSection – Affiche les filières d'une commune de manière dynamique
 * 
 * Récupère les données depuis entity?.serverData?.filiere et les affiche sous forme de grille.
 * Si pas de filières disponibles, affiche un message explicatif.
 */
export function ThematicsSection({
    id,
    props,
}: ThematicsSectionWrapperProps) {
    const { entity } = useCocolight();
    const t = useT("components/layout");

    type FiliereItem = { name: string; icon: string; tags?: string[] };
    const thematicKeys = Array.isArray(entity?.serverData?.thematic)
        ? (entity?.serverData?.thematic as string[])
        : [];

    const thematicEntries: Array<[string, FiliereItem]> = thematicKeys
        .filter((key) => key in ALL_THEME)
        .map((key) => [key, ALL_THEME[key]]);

    const rawFiliere = entity?.serverData?.filiere as unknown;
    const isSingleFiliereObject =
        !!rawFiliere &&
        typeof rawFiliere === "object" &&
        !Array.isArray(rawFiliere) &&
        "name" in rawFiliere &&
        "icon" in rawFiliere;

    const fallbackFiliereEntries: Array<[string, FiliereItem]> = isSingleFiliereObject
        ? [["filiere", rawFiliere as FiliereItem]]
        : Object.entries((rawFiliere as Record<string, unknown>) || {}).filter(([, value]) => {
              return value && typeof value === "object" && "name" in value && "icon" in value;
          }) as Array<[string, FiliereItem]>;

    const fiereEntries = thematicEntries.length > 0 ? thematicEntries : fallbackFiliereEntries;

    const hasThematics = fiereEntries.length > 0;

    // Props avec valeurs par défaut
    const {
        title = { fr: "Nos Thématiques", en: "Our Themes" },
        subtitle = { fr: "Explorez les différentes dimensions de votre Commune", en: "Explore the different dimensions of your Commune" },
        emptyMessage = { fr: "Aucune thématique n'est actuellement associée à cette commune", en: "No themes are currently associated with this commune" },
        filterHref,
    } = props;

    const handleFiliereClick = (key: string, data: FiliereItem) => {
        if (!filterHref) return;

        // Chercher les tags associés dans ALL_THEME (par clé ou par nom)
        const matchedKey = key in ALL_THEME
            ? key
            : Object.entries(ALL_THEME).find(([, v]) =>
                v.name.toLowerCase() === data.name.toLowerCase()
              )?.[0];

        const tagsToFilter = matchedKey
            ? ALL_THEME[matchedKey].tags          // tags du ALL_THEME (OR entre eux)
            : [data.name];                        // nom de la filière comme tag de

        sessionStorage.setItem("searchProStaticPrefilter", JSON.stringify({ tags: tagsToFilter }));
        window.location.href = filterHref;
    };

    // Extraire le dernier mot du titre pour le mettre en span styled
    const titleStr = t(title);
    const titleParts = titleStr.split(" ");
    const lastWord = titleParts.pop();
    const firstParts = titleParts.join(" ");

    return (
        <section id={id} className="py-12 px-4 bg-white">
            <div className="container mx-auto max-w-6xl">
                <h2 className="text-3xl md:text-4xl font-bold text-center mb-2">
                    {firstParts} <span className="text-teal-600">{lastWord}</span>
                </h2>
                <p className="text-center text-gray-600 text-base mb-8">
                    {t(subtitle)}
                </p>

                {!hasThematics ? (
                    // Message quand il n'y a pas de filières
                    <div className="flex items-center justify-center py-16">
                        <p className="text-gray-500 text-center text-lg">
                            {t(emptyMessage)}
                        </p>
                    </div>
                ) : (
                    // Grille des filières - centrée
                    <div className="flex flex-wrap justify-center gap-6">
                        {fiereEntries.map(([key, data]) => {
                            const iconName = data.icon as string;
                            const name = data.name;
                            const IconComponent = resolveLucideIcon(iconName);

                            return (
                                <a
                                    key={key}
                                    onClick={filterHref ? () => handleFiliereClick(key, data) : undefined}
                                    className={`flex flex-col items-center text-center p-4 rounded-lg hover:bg-gray-50 transition-all w-36${filterHref ? " cursor-pointer" : ""}`}
                                >
                                    <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center mb-3">
                                        {IconComponent ? (
                                            <IconComponent className="w-6 h-6 text-gray-700" />
                                        ) : (
                                            <div className="w-6 h-6 text-gray-700"></div>
                                        )}
                                    </div>
                                    <span className="font-semibold text-sm text-gray-800">
                                        {name}
                                    </span>
                                </a>
                            );
                        })}
                    </div>
                )}
            </div>
        </section>
    );
}

export default ThematicsSection;
