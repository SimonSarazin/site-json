import { useLocalization } from "@/hooks/useLocalization";
import { type ActionTilesProps } from "@/types/site-schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { DynamicIcon, type IconName } from "lucide-react/dynamic";
import { Link } from "react-router";
import { buildGridColsClass } from "./responsiveGridCols";
import { solidTileStyle, tileSizeClasses, tilesContainerWidth } from "./actionTileStyle";
import { sectionBadgeClass, sectionHeadlineStyle } from "./sectionBadge";

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


    const isSvgIcon = (icon: string) => icon.trim().startsWith("<svg");

    const ensureSvgHasClass = (svg: string, className: string) => {
        if (/class=["'][^"']*["']/i.test(svg)) {
            return svg.replace(/class=["']([^"']*)["']/i, (_match, existing) => `class="${existing} ${className}"`);
        }
        return svg.replace("<svg", `<svg class="${className}"`);
    };

    // `sizeClass` est le SEUL contrat de taille, SVG inline compris : la taille intrinsèque du SVG
    // (`width="48"`) ne compte pas, sinon `size: "lg"` et la pastille `inline` (`size-10`, qui attend
    // un `size-5`) n'auraient d'effet que sur les icônes lucide — grille désalignée, SVG qui déborde.
    const renderIcon = (icon: string, colorClass: string, sizeClass: string) => {
        if (isSvgIcon(icon)) {
            return (
                <div
                    className={`inline-flex shrink-0 items-center justify-center ${sizeClass} ${colorClass}`}
                    dangerouslySetInnerHTML={{ __html: ensureSvgHasClass(icon, "h-full w-full") }}
                />
            );
        }

        return (
            <DynamicIcon
                name={icon as IconName}
                className={`${sizeClass} ${colorClass}`}
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

    const enPastille = props.headlineStyle === "badge" || props.headlineStyle === "pill";
    const classePastille = sectionBadgeClass(props.headlineStyle);
    const enLigne = props.tileLayout === "inline";
    const tileSize = tileSizeClasses(props.size, props.density === "compact");
    const containerWidth = tilesContainerWidth(props.width);

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

    const compact = props.density === "compact";
    // Compact : la rangée vit DANS une autre bande (qui porte fond, padding et largeur) — elle n'en
    // rajoute aucun, sinon deux paddings et deux conteneurs se cumulent.
    const sectionBg = compact ? "" : props.bg && props.bg !== "default" ? BG_MAP[props.bg] : defaultBg;
    const lift = props.hoverEffect === "lift"
        ? "hover:shadow-lg focus-visible:shadow-lg motion-safe:hover:-translate-y-1 motion-safe:focus-visible:-translate-y-1 duration-200"
        : "";

    // `pillRow` : titre de section ET actions sur UNE SEULE ligne (qui passe en colonne sous `sm`),
    // chaque action en bouton PILULE (icône en pastille, libellé, flèche) — pas de sous-titre, pas de
    // grille de tuiles. Branche isolée : les tuiles `centered`/`inline` ci-dessous n'en sont pas
    // affectées, et réciproquement.
    if (props.tileLayout === "pillRow") {
        return (
            <section id={id} className={compact ? "" : `px-4 ${sectionBg} py-16`}>
                <div className={compact ? "" : `container mx-auto ${containerWidth}`}>
                    <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6">
                        {props.headline && (
                            <h2>
                                {/* Police héritée de la règle globale `h1-h4` (`--font-serif`/Patrick Hand) —
                                    PAS la police du menu : le titre garde le même repère manuscrit que
                                    « Territoires »/« À la une », à côté d'actions qui, elles, restent en
                                    police du thème. */}
                                <Badge
                                    variant={props.accentColor ? undefined : "secondary"}
                                    style={sectionHeadlineStyle(props.headlineStyle, props.accentColor, undefined)}
                                    className={classePastille}
                                >
                                    {t(props.headline)}
                                </Badge>
                            </h2>
                        )}
                        {props.actions.map((action, index) => {
                            const solid = solidTileStyle(action.background, action.textColor);
                            return (
                                <Link key={index} to={action.href}>
                                    <Button
                                        size="lg"
                                        style={solid}
                                        className={`h-auto rounded-full py-4 pl-4 pr-6 gap-3 text-lg font-bold whitespace-normal border transition-all ${lift} ${solid ? "hover:brightness-95" : getButtonClasses(action.color)}`}
                                    >
                                        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-current/15">
                                            {renderIcon(action.icon, solid ? "" : getIconColorClass(action.color), "size-5")}
                                        </span>
                                        <span>{t(action.title)}</span>
                                        <ArrowRight className="size-5 shrink-0" aria-hidden />
                                    </Button>
                                </Link>
                            );
                        })}
                    </div>
                </div>
            </section>
        );
    }

    return (
        <section id={id} className={compact ? "" : `px-4 ${sectionBg} py-16 `}>
            <div className={compact ? "" : `container mx-auto ${containerWidth}`}>
                <div className={`${compact ? "mb-3" : "mb-10"} ${enPastille ? "" : "text-center"}`}>
                    {props.headline &&
                        (enPastille ? (
                            // Même pastille que les autres bandes de la page (cf. `sectionBadgeClass`).
                            <h2 className={compact ? "mb-1" : "mb-4"}>
                                <Badge
                                    variant={props.accentColor ? undefined : "secondary"}
                                    style={sectionHeadlineStyle(props.headlineStyle, props.accentColor, undefined)}
                                    className={classePastille}
                                >
                                    {t(props.headline)}
                                </Badge>
                            </h2>
                        ) : (
                            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-foreground">
                                {t(props.headline)}
                            </h2>
                        ))}
                    {props.subhead && (
                        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                            {t(props.subhead)}
                        </p>
                    )}
                </div>

                <div className={`grid ${gridColsClass} gap-4`}>
                    {props.actions.map((action, index) => {
                        // Fond plein (`background`) : le style en ligne remplace la teinte de thème, et
                        // icône comme sous-titre héritent de `textColor` au lieu des couleurs du thème.
                        const solid = solidTileStyle(action.background, action.textColor);
                        return (
                            // `h-full` sur le lien et la tuile : toutes les tuiles d'une rangée prennent la
                            // hauteur de la plus haute, quelle que soit la longueur de leurs textes.
                            <Link key={index} to={action.href} className="h-full">
                                <Button
                                    size="lg"
                                    style={solid}
                                    // `whitespace-normal` : la base du Button pose `whitespace-nowrap`,
                                    // qui empêche titre et sous-titre de passer à la ligne — sur mobile,
                                    // un sous-titre plus large que l'écran débordait de la tuile.
                                    className={`h-full w-full ${tileSize.box} flex flex-col gap-3 text-foreground border transition-all whitespace-normal ${lift} ${enLigne ? "items-start rounded-2xl px-6 text-left shadow-sm" : "items-center text-center"} ${solid ? "hover:brightness-95" : getButtonClasses(action.color)}`}
                                >
                                    {enLigne ? (
                                        // Icône en pastille, titre à côté : `bg-current/10` suit l'encre de la
                                        // tuile, donc tient aussi bien sur un aplat que sur une teinte claire.
                                        <span className="flex items-center gap-3">
                                            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-current/10">
                                                {renderIcon(action.icon, solid ? "" : getIconColorClass(action.color), "size-5")}
                                            </span>
                                            <span className={tileSize.title}>{t(action.title)}</span>
                                        </span>
                                    ) : (
                                        <>
                                            {renderIcon(action.icon, solid ? "" : getIconColorClass(action.color), tileSize.icon)}
                                            <span className={tileSize.title}>{t(action.title)}</span>
                                        </>
                                    )}
                                    {action.subtitle && (
                                        <span className={solid ? tileSize.subtitle : `${tileSize.subtitle} text-muted-foreground`}>
                                            {t(action.subtitle)}
                                        </span>
                                    )}
                                </Button>
                            </Link>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}

export default ActionTiles;
