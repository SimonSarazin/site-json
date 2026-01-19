import { useState, useEffect } from "react";
import { useLocalization } from "@/hooks/useLocalization";
import { HeroRezoLaMerProps as SchemaHeroRezoLaMerProps } from "@/types/site-schema";
import { Link } from "react-router";

interface HeroRezoLaMerProps {
    id?: string;
    props: SchemaHeroRezoLaMerProps;
}

export function HeroRezoLaMer({ props }: HeroRezoLaMerProps) {
    const { t } = useLocalization();
    const [scrollY, setScrollY] = useState(0);

    useEffect(() => {
        const handleScroll = () => setScrollY(window.scrollY);
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    return (
        <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-ocean-deep">
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
                    <div className="absolute inset-0 bg-linear-to-b from-ocean-deep/80 via-ocean-deep/60 to-ocean-deep" />
                </div>
            )}

            <div className="relative z-10 container mx-auto px-4 py-32 text-center">
                <div className="max-w-4xl mx-auto space-y-8 animate-fade-in-up">
                    {props.logoIcon && (
                        <div className="flex justify-center mb-6">
                            <div className="relative">
                                <span
                                    className="w-20 h-20 text-turquoise animate-float flex items-center justify-center [&>svg]:w-20 [&>svg]:h-20"
                                    dangerouslySetInnerHTML={{ __html: props.logoIcon }}
                                />
                                <span
                                    className="absolute inset-0 animate-pulse-glow opacity-50 text-cyan-bright flex items-center justify-center [&>svg]:w-20 [&>svg]:h-20"
                                    dangerouslySetInnerHTML={{ __html: props.logoIcon }}
                                />
                            </div>
                        </div>
                    )}

                    <h1 className="text-5xl md:text-7xl font-bold text-ocean-text-light mb-6 leading-tight text-glow">
                        {t(props.headline)}
                    </h1>

                    {props.subhead && (
                        <p className="text-xl md:text-2xl text-ocean-text-muted max-w-3xl mx-auto leading-relaxed">
                            {t(props.subhead)}
                        </p>
                    )}

                    {props.badges && props.badges.length > 0 && (
                        <div className="flex flex-wrap justify-center gap-4 pt-8">
                            {props.badges.map((badge, idx) => (
                                <div
                                    key={idx}
                                    className="flex items-center gap-2 px-4 py-2 rounded-full bg-ocean-mid/30 backdrop-blur-ocean border border-turquoise/20"
                                >
                                    {badge.icon && (
                                        <span
                                            className="w-5 h-5 text-turquoise flex items-center justify-center [&>svg]:w-5 [&>svg]:h-5"
                                            dangerouslySetInnerHTML={{ __html: badge.icon }}
                                        />
                                    )}
                                    <span className="text-sm font-medium text-ocean-text-muted">{t(badge.label)}</span>
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
                                    className={
                                        btn.variant === "secondary"
                                            ? "px-8 py-4 text-lg font-medium border-2 border-ocean-text-light/50 bg-ocean-mid/20 backdrop-blur-ocean hover:bg-ocean-mid/40 text-ocean-text-light rounded-md transition-all"
                                            : "px-8 py-4 text-lg font-medium bg-turquoise hover:bg-turquoise/90 text-ocean-deep rounded-md shadow-ocean hover:shadow-glow transition-all"
                                    }
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
                    <div className="w-6 h-10 border-2 border-turquoise/50 rounded-full flex items-start justify-center p-2">
                        <div className="w-1 h-3 bg-turquoise rounded-full animate-pulse"></div>
                    </div>
                </div>
            )}
        </section>
    );
}

export default HeroRezoLaMer;
