import { useState, useEffect } from "react";
import { useLocalization } from "@/hooks/useLocalization";
import { HeroParallaxProps as SchemaHeroParallaxProps } from "@/types/site-schema";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { DynamicIcon, type IconName } from "lucide-react/dynamic";
import { HeroBackgroundImage } from "./HeroBackgroundImage";
import { ActionButtonGroup } from "@/modules/profil/components/ActionButtonGroup";

/**
 * Icône de badge : SVG inline OU nom d'icône lucide.
 *
 * La section n'acceptait que du SVG inline (`dangerouslySetInnerHTML`), si bien
 * qu'écrire `"waves"` imprimait littéralement le mot « waves » à côté du
 * libellé — sans erreur ni avertissement. Or tout le reste du moteur
 * (`ActionTiles`, `cta-card-grid`…) accepte les deux formes, et le schéma dit
 * seulement `icon: string`. On aligne donc le comportement.
 *
 * Additif : les 5 configs du parc qui emploient ces badges écrivent toutes du
 * SVG inline et passent par la même branche qu'avant.
 */
function BadgeIcon({ icon, className }: { icon: string; className: string }) {
    if (icon.trim().startsWith("<svg")) {
        return <span className={className} dangerouslySetInnerHTML={{ __html: icon }} />;
    }
    return (
        <span className={className}>
            <DynamicIcon name={icon as IconName} />
        </span>
    );
}

interface HeroParallaxProps {
    id?: string;
    props: SchemaHeroParallaxProps;
}

export function HeroParallax({ id, props }: HeroParallaxProps) {
    const { t } = useLocalization();
    const [scrollY, setScrollY] = useState(0);
    const variant = props.variant || "primary";
    const isAccent = variant === "accent";

    useEffect(() => {
        const handleScroll = () => setScrollY(window.scrollY);
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    /**
     * Gabarit de CTA de hero : plus grand que les tailles de `Button` (qui
     * plafonnent à `h-10`), d'où ce dimensionnement en supplément — mais les
     * COULEURS et les états viennent désormais du `Button` shadcn, au lieu d'être
     * recomposés à la main.
     */
    const HERO_CTA_SIZE = "h-auto px-8 py-4 text-lg font-medium";

    /**
     * Variant de config → variant de `Button`.
     *
     * `secondary` et `accent` gardent une surface translucide + `backdrop-blur` :
     * ces boutons se posent sur une photo plein écran, où un aplat opaque
     * masquerait l'image. `outline` était déclaré au schéma mais NON traité — il
     * retombait sur la branche primaire, rendant deux boutons identiques là où la
     * config en demandait un contrasté, sans erreur ni avertissement. Aucune
     * config du parc ne l'employait avant institut-bleu.
     */
    const getButtonProps = (
        btnVariant?: "default" | "secondary" | "accent" | "primary" | "outline",
    ): { variant: React.ComponentProps<typeof Button>["variant"]; className: string } => {
        if (btnVariant === "secondary") {
            return {
                variant: "secondary",
                className: `${HERO_CTA_SIZE} border-2 border-foreground/50 bg-secondary/20 backdrop-blur-sm hover:bg-secondary/40 text-foreground`,
            };
        }
        if (btnVariant === "accent") {
            return {
                variant: "default",
                className: `${HERO_CTA_SIZE} bg-accent hover:bg-accent/90 text-accent-foreground shadow-lg hover:shadow-xl`,
            };
        }
        if (btnVariant === "outline") {
            return {
                variant: "outline",
                className: `${HERO_CTA_SIZE} border-2 border-primary bg-background/70 backdrop-blur-sm text-primary hover:bg-primary hover:text-primary-foreground dark:bg-background/70 dark:border-primary dark:hover:bg-primary`,
            };
        }
        return {
            variant: "default",
            className: `${HERO_CTA_SIZE} shadow-lg hover:shadow-xl`,
        };
    };

    return (
        <section id={id} className="relative min-h-screen flex items-center justify-center overflow-hidden bg-background">
            {props.backgroundImage && (
                <div
                    className="absolute inset-0 z-0"
                    style={{
                        transform: `translateY(${scrollY * 0.5}px)`,
                        transition: 'transform 0.1s ease-out'
                    }}
                >
                    <HeroBackgroundImage
                        src={props.backgroundImage}
                        alt={props.backgroundImageAlt ? t(props.backgroundImageAlt) : ""}
                        className="w-full h-[120vh] object-cover"
                        priority
                    />
                    <div
                        className="absolute inset-0"
                        style={{
                            background: `linear-gradient(to bottom, color-mix(in oklch, var(--color-background) 80%, transparent), color-mix(in oklch, var(--color-background) ${(props as unknown as Record<string, unknown>).overlayOpacity ?? "60%"}, transparent), var(--color-background))`
                        }}
                    />
                </div>
            )}

            <div className="relative z-10 container mx-auto px-4 py-32 text-center">
                <div className="max-w-4xl mx-auto space-y-8 animate-fade-in-up">
                    {props.logoIcon && (
                        <div className="flex justify-center mb-6">
                            <div className="relative">
                                <span
                                    className="w-20 h-20 text-primary animate-float flex items-center justify-center [&>svg]:w-20 [&>svg]:h-20"
                                    dangerouslySetInnerHTML={{ __html: props.logoIcon }}
                                />
                                <span
                                    className={`absolute inset-0 animate-pulse-glow opacity-50 flex items-center justify-center [&>svg]:w-20 [&>svg]:h-20 ${isAccent ? "text-accent" : "text-chart-2"}`}
                                    dangerouslySetInnerHTML={{ __html: props.logoIcon }}
                                />
                            </div>
                        </div>
                    )}

                    <h1 className="text-5xl md:text-7xl font-bold text-foreground mb-6 leading-tight text-shadow-glow">
                        {t(props.headline)}
                    </h1>

                    {props.subhead && (
                        <p
                            className="text-xl md:text-2xl max-w-3xl mx-auto leading-relaxed"
                                style={{ color: (props as unknown as Record<string, unknown>).subheadColor as string ?? "var(--color-muted-foreground)" }}
                        >
                            {t(props.subhead)}
                        </p>
                    )}

                    {props.badges && props.badges.length > 0 && (
                        <div className="flex flex-wrap justify-center gap-4 pt-8">
                            {props.badges.map((badge, idx) => (
                                <div
                                    key={idx}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-full backdrop-blur-sm border ${isAccent ? "bg-secondary/30 border-accent/30" : "bg-secondary/30 border-primary/20"}`}
                                >
                                    {badge.icon && (
                                        <BadgeIcon
                                            icon={badge.icon}
                                            className={`w-5 h-5 flex items-center justify-center [&>svg]:w-5 [&>svg]:h-5 ${isAccent ? "text-accent" : "text-primary"}`}
                                        />
                                    )}
                                    <span className="text-sm font-medium text-muted-foreground">{t(badge.label)}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {((props.ctaButtons && props.ctaButtons.length > 0) ||
                      (props.buttons && props.buttons.length > 0)) && (
                        <div className="flex flex-col sm:flex-row gap-4 justify-center pt-8">
                            {props.ctaButtons?.map((btn, idx) => {
                                const { variant, className } = getButtonProps(btn.variant);
                                return (
                                    <Button key={idx} asChild variant={variant} className={className}>
                                        <Link to={btn.path || "#"}>{t(btn.label)}</Link>
                                    </Button>
                                );
                            })}
                            {/* Boutons d'ACTION (modale d'ajout) — même composant que
                                `searchHeader` (SearchHeaderSection.tsx:373), donc même
                                garde d'authentification : un visiteur non connecté voit
                                l'invite `chrome.authPrompt` du formulaire au lieu d'une
                                impasse. Séparé de `ctaButtons`, qui ne sait que naviguer. */}
                            {props.buttons && props.buttons.length > 0 && (
                                <ActionButtonGroup buttons={props.buttons} />
                            )}
                        </div>
                    )}
                </div>
            </div>

            {props.showScrollIndicator && (
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 animate-bounce pointer-events-none">
                    <div className="w-6 h-10 border-2 border-primary/50 rounded-full flex items-start justify-center p-2">
                        <div className="w-1 h-3 bg-primary rounded-full motion-safe:animate-pulse"></div>
                    </div>
                </div>
            )}
        </section>
    );
}

export default HeroParallax;
