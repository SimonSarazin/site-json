import { useState, useEffect } from "react";
import { useLocalization } from "@/hooks/useLocalization";
import { HeroParallaxProps as SchemaHeroParallaxProps } from "@/types/site-schema";
import { Link } from "react-router";

interface HeroParallaxProps {
    id?: string;
    props: SchemaHeroParallaxProps;
}

export function HeroParallax({ props }: HeroParallaxProps) {
    const { t } = useLocalization();
    const [scrollY, setScrollY] = useState(0);
    const variant = props.variant || "primary";
    const isAccent = variant === "accent";

    useEffect(() => {
        const handleScroll = () => setScrollY(window.scrollY);
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    const getButtonClasses = (btnVariant?: "default" | "secondary" | "accent" | "primary" | "outline") => {
        if (btnVariant === "secondary") {
            return "px-8 py-4 text-lg font-medium border-2 border-foreground/50 bg-secondary/20 backdrop-blur-sm hover:bg-secondary/40 text-foreground rounded-md transition-all";
        }
        if (btnVariant === "accent") {
            return "px-8 py-4 text-lg font-medium bg-accent hover:bg-accent/90 text-accent-foreground rounded-md shadow-lg hover:shadow-xl transition-all";
        }
        return "px-8 py-4 text-lg font-medium bg-primary hover:bg-primary/90 text-primary-foreground rounded-md shadow-lg hover:shadow-xl transition-all";
    };

    return (
        <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-background">
            {props.backgroundImage && (
                <div
                    className="absolute inset-0 z-0"
                    style={{
                        transform: `translateY(${scrollY * 0.5}px)`,
                        transition: 'transform 0.1s ease-out'
                    }}
                >
                    <img
                        src={props.backgroundImage}
                        alt={props.backgroundImageAlt ? t(props.backgroundImageAlt) : ""}
                        className="w-full h-[120vh] object-cover"
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

                    <h1 className="text-5xl md:text-7xl font-bold text-foreground mb-6 leading-tight text-glow">
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
                                        <span
                                            className={`w-5 h-5 flex items-center justify-center [&>svg]:w-5 [&>svg]:h-5 ${isAccent ? "text-accent" : "text-primary"}`}
                                            dangerouslySetInnerHTML={{ __html: badge.icon }}
                                        />
                                    )}
                                    <span className="text-sm font-medium text-muted-foreground">{t(badge.label)}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {props.ctaButtons && props.ctaButtons.length > 0 && (
                        <div className="flex flex-col sm:flex-row gap-4 justify-center pt-8">
                            {props.ctaButtons.map((btn, idx) => (
                                <Link
                                    key={idx}
                                    to={btn.path || "#"}
                                    className={getButtonClasses(btn.variant)}
                                >
                                    {t(btn.label)}
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {props.showScrollIndicator && (
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 animate-bounce">
                    <div className="w-6 h-10 border-2 border-primary/50 rounded-full flex items-start justify-center p-2">
                        <div className="w-1 h-3 bg-primary rounded-full animate-pulse"></div>
                    </div>
                </div>
            )}
        </section>
    );
}

export default HeroParallax;
