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
     * Couleurs de tuile.
     *
     * Les tokens du thème (`primary`, `accent`, `destructive`, `chart-1..5`)
     * sont la voie à privilégier : ils suivent la charte du site.
     *
     * `teal` / `amber` / `eco` / `turquoise` / `cyan-bright` sont des littéraux
     * Tailwind, identiques sur tous les sites. C'est un défaut — mais les
     * REMAPPER sur `chart-2..4` a été essayé et fait pire : ces jetons forment
     * une palette SÉQUENTIELLE (une rampe de graphique), pas catégorielle. Sur
     * rezo-la-mer, `chart-2`/`chart-3`/`chart-4` sont trois nuances du même
     * orange : les deux tuiles colorées de sa home passaient à 10/441 d'écart,
     * indiscernables. Sur parent62, `teal → chart-2` rendait les deux tuiles
     * `teal` STRICTEMENT identiques à la tuile `chart-2` voisine (écart 0),
     * détruisant une distinction voulue par le concepteur.
     *
     * Les 5 configs qui emploient ces alias gardent donc leur rendu. Le vrai
     * correctif est de migrer ces configs vers des tokens choisis un par un —
     * un arbitrage de design par site, pas une substitution mécanique.
     */
    const TILE_STYLES: Record<string, { button: string; icon: string }> = {
        // Tokens du thème — à préférer pour toute nouvelle config.
        // Classes écrites en toutes lettres : Tailwind ne détecte pas les noms
        // concaténés à l'exécution, une classe construite serait purgée du build.
        primary: { button: "bg-primary/20 hover:bg-primary/30 border-primary/30 hover:border-primary/50", icon: "text-primary" },
        accent: { button: "bg-accent/20 hover:bg-accent/30 border-accent/30 hover:border-accent/50", icon: "text-accent" },
        destructive: { button: "bg-destructive/20 hover:bg-destructive/30 border-destructive/30 hover:border-destructive/50", icon: "text-destructive" },
        "chart-1": { button: "bg-chart-1/20 hover:bg-chart-1/30 border-chart-1/30 hover:border-chart-1/50", icon: "text-chart-1" },
        "chart-2": { button: "bg-chart-2/20 hover:bg-chart-2/30 border-chart-2/30 hover:border-chart-2/50", icon: "text-chart-2" },
        "chart-3": { button: "bg-chart-3/20 hover:bg-chart-3/30 border-chart-3/30 hover:border-chart-3/50", icon: "text-chart-3" },
        "chart-4": { button: "bg-chart-4/20 hover:bg-chart-4/30 border-chart-4/30 hover:border-chart-4/50", icon: "text-chart-4" },
        "chart-5": { button: "bg-chart-5/20 hover:bg-chart-5/30 border-chart-5/30 hover:border-chart-5/50", icon: "text-chart-5" },
        // Littéraux hérités — conservés à l'identique (cf. commentaire ci-dessus).
        amber: { button: "bg-amber-500/20 hover:bg-amber-500/30 border-amber-500/30 hover:border-amber-500/50", icon: "text-amber-400" },
        teal: { button: "bg-teal-500/20 hover:bg-teal-500/30 border-teal-500/30 hover:border-teal-500/50", icon: "text-teal-500" },
        turquoise: { button: "bg-teal-500/20 hover:bg-teal-500/30 border-teal-500/30 hover:border-teal-500/50", icon: "text-teal-500" },
        "cyan-bright": { button: "bg-cyan-400/20 hover:bg-cyan-400/30 border-cyan-400/30 hover:border-cyan-400/50", icon: "text-cyan-400" },
        eco: { button: "bg-emerald-500/20 hover:bg-emerald-500/30 border-emerald-500/30 hover:border-emerald-500/50", icon: "text-emerald-500" },
    };

    const tileStyle = (color?: string) => TILE_STYLES[color ?? ""] ?? TILE_STYLES.primary;

    const getButtonClasses = (color?: string) => tileStyle(color).button;

    const getIconColorClass = (color?: string) => tileStyle(color).icon;

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
                                // `whitespace-normal` : la base du Button pose `whitespace-nowrap`,
                                // qui empêche titre et sous-titre de passer à la ligne — sur mobile,
                                // un sous-titre plus large que l'écran débordait de la tuile.
                                className={`h-auto w-full py-6 flex flex-col items-center gap-3 text-foreground border transition-all whitespace-normal text-center ${getButtonClasses(action.color)}`}
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
