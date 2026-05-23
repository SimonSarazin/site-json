import { useCocolight } from "@/hooks/useCocolight";
import {
    Utensils, Heart, Link, Globe, Bus, Book, CircleUser, Sun, Accessibility,
    TreePine, Laptop, CircleDot, Trash2, Smartphone, Leaf, Banknote, Move, Hand,
    FlaskConical, Lightbulb, Cross, Scale, Anchor, HelpCircle,
} from "lucide-react";
import type { ThematicsSectionProps } from "../schema";
import { FILIERE_ICON_MAPPING } from "../schema";
import "@/modules/search/i18n";
import { useT } from "@/hooks/useT";
import { ComponentType } from "react";

export interface ThematicsSectionWrapperProps {
    id?: string;
    props: ThematicsSectionProps;
}

/**
 * Mapping kebab-case → composant lucide importé en nommé.
 * Couvre les valeurs de `FILIERE_ICON_MAPPING` (24 icônes) + le fallback
 * `HelpCircle`. Imports statiques → tree-shaking actif (sinon `import *`
 * forcerait le bundling complet de lucide-react ~880KB raw).
 */
const ICON_MAP: Record<string, ComponentType<{ className?: string }>> = {
    "utensils": Utensils,
    "heart": Heart,
    "link": Link,
    "globe": Globe,
    "bus": Bus,
    "book": Book,
    "circle-user": CircleUser,
    "sun": Sun,
    "accessibility": Accessibility,
    "tree-pine": TreePine,
    "laptop": Laptop,
    "circle-dot": CircleDot,
    "trash-2": Trash2,
    "smartphone": Smartphone,
    "leaf": Leaf,
    "banknote": Banknote,
    "move": Move,
    "hand": Hand,
    "flask-conical": FlaskConical,
    "lightbulb": Lightbulb,
    "cross": Cross,
    "scale": Scale,
    "anchor": Anchor,
};

/**
 * Convertir un nom d'icône FontAwesome en icône Lucide
 */
function resolveLucideIcon(faIconName: string): ComponentType<{ className?: string }> | null {
    const normalizedName = faIconName.trim();
    const lucideName = FILIERE_ICON_MAPPING[normalizedName.toLowerCase()]
        || FILIERE_ICON_MAPPING[faIconName.toLowerCase()];

    if (!lucideName) {
        console.warn(`[ThematicsSection] Icon mapping not found for: ${faIconName}`);
        return HelpCircle;
    }
    return ICON_MAP[lucideName] ?? null;
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
    // Récupérer les filières depuis les données de l'entité
    const filiere = entity?.serverData?.filiere || {};
    const fiereEntries = Object.entries(filiere).filter(([, value]) => {
        return value && typeof value === "object" && "name" in value && "icon" in value;
    });

    const hasThematics = fiereEntries.length > 0;

    // Props avec valeurs par défaut
    const {
        title = { fr: "Nos Thématiques", en: "Our Themes" },
        subtitle = { fr: "Explorez les différentes dimensions de votre Commune", en: "Explore the different dimensions of your Commune" },
        emptyMessage = { fr: "Aucune thématique n'est actuellement associée à cette commune", en: "No themes are currently associated with this commune" },
    } = props;

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
                    // Grille des filières
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                        {fiereEntries.map(([key, data]) => {
                            const iconName = data.icon as string;
                            const name = data.name;
                            const IconComponent = resolveLucideIcon(iconName);

                            return (
                                <a
                                    key={key}
                                    className="flex flex-col items-center text-center p-4 rounded-lg hover:bg-gray-50 transition-all cursor-pointer"
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
