import { useLocalization } from "@/hooks/useLocalization";
import { type ActionTilesProps } from "@/types/site-schema";
import { Button } from "@/components/ui/button";
import { DynamicIcon, type IconName } from "lucide-react/dynamic";
import { Link } from "react-router";
import { buildGridColsClass } from "./responsiveGridCols";

interface ActionTilesSectionProps {
    id?: string;
    props: ActionTilesProps;
}

export function ActionTiles({ id, props }: ActionTilesSectionProps) {
    const { t } = useLocalization();
    const variant = props.variant || "primary";
    const isAccent = variant === "accent";

    // `columns` (si fourni) pilote la grille ; sinon défaut sm:2 lg:4.
    const gridColsClass = props.columns
        ? buildGridColsClass(props.columns)
        : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4";

    const DEFAULT_ICON_SIZE = 32;

    const isSvgIcon = (icon: string) => icon.trim().startsWith("<svg");

    const getSvgSize = (svg: string) => {
        const widthMatch = svg.match(/width=["'](\d+(?:\.\d+)?)["']/i);
        return widthMatch ? Number(widthMatch[1]) : DEFAULT_ICON_SIZE;
    };

    const getSizeClass = (size: number) => {
        if (size <= 20) return "size-5";
        if (size <= 24) return "size-6";
        if (size <= 28) return "size-7";
        if (size <= 32) return "size-8";
        if (size <= 40) return "size-10";
        if (size <= 48) return "size-12";
        if (size <= 56) return "size-14";
        return "size-16";
    };

    const ensureSvgHasClass = (svg: string, className: string) => {
        if (/class=["'][^"']*["']/i.test(svg)) {
            return svg.replace(/class=["']([^"']*)["']/i, (_match, existing) => `class="${existing} ${className}"`);
        }
        return svg.replace("<svg", `<svg class="${className}"`);
    };

    const renderIcon = (icon: string, colorClass: string) => {
        if (isSvgIcon(icon)) {
            const sizeInPixels = getSvgSize(icon);
            const svgWithSizeClass = ensureSvgHasClass(icon, getSizeClass(sizeInPixels));

            return (
                <div
                    className={`inline-flex items-center justify-center ${colorClass}`}
                    style={{ width: sizeInPixels, height: sizeInPixels }}
                    dangerouslySetInnerHTML={{ __html: svgWithSizeClass }}
                />
            );
        }

        return (
            <DynamicIcon
                name={icon as IconName}
                className={`w-8 h-8 ${colorClass}`}
            />
        );
    };

    /**
     * Couleurs de tuile — TOKENS DU THÈME uniquement.
     *
     * `teal` / `amber` / `eco` codaient en dur `teal-500` / `amber-500` /
     * `emerald-500` de la palette Tailwind : les mêmes trois couleurs sur tous
     * les sites, sans aucun rapport avec leur charte (sur cyber-réunion, une
     * identité bleu République / or européen s'affichait en menthe et pêche).
     * Ces noms restent acceptés — 5 configs du parc les emploient — mais ils
     * pointent désormais sur `chart-2..4`, la palette catégorielle que CHAQUE
     * config déclare. Chaque site porte donc enfin ses propres couleurs.
     */
    const TILE_TOKEN: Record<string, string> = {
        accent: "accent",
        primary: "primary",
        destructive: "destructive",
        "chart-1": "chart-1",
        "chart-2": "chart-2",
        "chart-3": "chart-3",
        "chart-4": "chart-4",
        "chart-5": "chart-5",
        // alias historiques
        teal: "chart-2",
        turquoise: "chart-2",
        "cyan-bright": "chart-2",
        amber: "chart-3",
        eco: "chart-4",
    };

    // Classes écrites en toutes lettres : Tailwind ne détecte pas les noms
    // concaténés à l'exécution, une classe construite serait purgée du build.
    const BUTTON_CLASSES: Record<string, string> = {
        primary: "bg-primary/20 hover:bg-primary/30 border-primary/30 hover:border-primary/50",
        accent: "bg-accent/20 hover:bg-accent/30 border-accent/30 hover:border-accent/50",
        destructive: "bg-destructive/20 hover:bg-destructive/30 border-destructive/30 hover:border-destructive/50",
        "chart-1": "bg-chart-1/20 hover:bg-chart-1/30 border-chart-1/30 hover:border-chart-1/50",
        "chart-2": "bg-chart-2/20 hover:bg-chart-2/30 border-chart-2/30 hover:border-chart-2/50",
        "chart-3": "bg-chart-3/20 hover:bg-chart-3/30 border-chart-3/30 hover:border-chart-3/50",
        "chart-4": "bg-chart-4/20 hover:bg-chart-4/30 border-chart-4/30 hover:border-chart-4/50",
        "chart-5": "bg-chart-5/20 hover:bg-chart-5/30 border-chart-5/30 hover:border-chart-5/50",
    };

    const ICON_CLASSES: Record<string, string> = {
        primary: "text-primary",
        accent: "text-accent",
        destructive: "text-destructive",
        "chart-1": "text-chart-1",
        "chart-2": "text-chart-2",
        "chart-3": "text-chart-3",
        "chart-4": "text-chart-4",
        "chart-5": "text-chart-5",
    };

    const getButtonClasses = (color?: string) => {
        const token = TILE_TOKEN[color ?? ""] ?? "primary";
        return BUTTON_CLASSES[token];
    };

    const getIconColorClass = (color?: string) => {
        const token = TILE_TOKEN[color ?? ""] ?? "primary";
        return ICON_CLASSES[token];
    };

    const BG_MAP: Record<string, string> = {
        card: "bg-card",
        muted: "bg-muted",
        primary: "bg-primary/10",
        secondary: "bg-secondary",
        accent: "bg-accent/10",
        transparent: "bg-transparent",
    };

    const defaultBg = isAccent
        ? "bg-gradient-to-b from-card/20 to-background"
        : "bg-linear-to-b from-background/80 to-background";

    const sectionBg = props.bg && props.bg !== "default" ? BG_MAP[props.bg] : defaultBg;

    return (
        <section id={id} className={`px-4 ${sectionBg} py-16 `}>
            <div className="container mx-auto max-w-5xl">
                <div className="text-center mb-10">
                    {props.headline && (
                        <h2 className="text-3xl md:text-4xl font-bold mb-4 text-foreground">
                            {t(props.headline)}
                        </h2>
                    )}
                    {props.subhead && (
                        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                            {t(props.subhead)}
                        </p>
                    )}
                </div>

                <div className={`grid ${gridColsClass} gap-4`}>
                    {props.actions.map((action, index) => (
                        <Link key={index} to={action.href}>
                            <Button
                                size="lg"
                                className={`h-auto w-full py-6 flex flex-col items-center gap-3 text-foreground border transition-all ${getButtonClasses(action.color)}`}
                            >
                                {renderIcon(action.icon, getIconColorClass(action.color))}
                                <span className="font-semibold">{t(action.title)}</span>
                                {action.subtitle && (
                                    <span className="text-xs text-muted-foreground">
                                        {t(action.subtitle)}
                                    </span>
                                )}
                            </Button>
                        </Link>
                    ))}
                </div>
            </div>
        </section>
    );
}

export default ActionTiles;
