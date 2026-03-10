import { useLocalization } from "@/hooks/useLocalization";
import type { HeroCommuneTransparenteProps } from "@/types/site-schema";
import { DynamicIcon } from "lucide-react/dynamic";

interface HeroCommuneTransparenteSectionProps {
    id?: string;
    props: HeroCommuneTransparenteProps;
}

export function HeroCommuneTransparenteSection({ id, props }: HeroCommuneTransparenteSectionProps) {
    const { t } = useLocalization();

    return (
        <section id={id} className="relative min-h-screen flex flex-col overflow-hidden">
            {/* ── Image de fond ── */}
            {props.backgroundImage && (
                <>
                    <img
                        src={props.backgroundImage}
                        alt={props.backgroundImageAlt ? t(props.backgroundImageAlt) : ""}
                        className="absolute inset-0 w-full h-full object-cover z-0"
                    />
                    {/* Overlay violet sombre dégradé, fidèle à l'image */}
                    <div className="absolute inset-0 z-10 bg-ct-hero-overlay" />
                    <div className="absolute inset-0 z-10 bg-linear-to-b from-black/20 via-transparent to-black/40" />
                </>
            )}

            {/* ── Contenu centré ── */}
            <div className="relative z-20 flex flex-col items-center justify-center flex-1 text-center px-4 pt-28 pb-16">

                {/* Logo / Icône du site */}
                {props.logoIcon && (
                    <div
                        className="flex items-center justify-center w-16 h-16 mb-6 [&>svg]:w-16 [&>svg]:h-16 ct-animate-in ct-delay-1"
                        dangerouslySetInnerHTML={{ __html: props.logoIcon }}
                    />
                )}
                {props.logoImage && (
                    <img
                        src={props.logoImage}
                        alt={props.headline ? t(props.headline) : "logo"}
                        className="h-24 w-auto mb-16 object-contain ct-animate-in ct-delay-1"
                    />
                )}

                {/* Headline */}
                {props.headline && (
                    <h1 className="text-white text-3xl sm:text-5xl md:text-6xl font-extrabold mb-16 drop-shadow-lg ct-animate-in ct-delay-2 leading-tight">
                        {t(props.headline)}
                    </h1>
                )}

                {/* Subhead */}
                {props.subhead && (
                    <p className="text-white/90 text-base sm:text-lg md:text-xl font-light mb-16 drop-shadow max-w-2xl ct-animate-in ct-delay-3">
                        {t(props.subhead)}
                    </p>
                )}

                {/* Badges / Features horizontaux */}
                {props.badges && props.badges.length > 0 && (
                    <div className="flex flex-wrap justify-center gap-3 mb-10 ct-animate-in ct-delay-3">
                        {props.badges.map((badge, idx) => (
                            <span
                                key={idx}
                                className="flex items-center gap-2 bg-white/15 border border-white/30 backdrop-blur-sm text-white text-sm font-medium px-4 py-2 rounded-full shadow"
                            >
                                {badge.icon && (
                                    <DynamicIcon name={badge.icon as any} className="w-4 h-4 shrink-0" />
                                )}
                                {t(badge.label)}
                            </span>
                        ))}
                    </div>
                )}

                {/* CTA Buttons */}
                {props.ctaButtons && props.ctaButtons.length > 0 && (
                    <div className="flex flex-wrap justify-center gap-4 ct-animate-in ct-delay-4">
                        {props.ctaButtons.map((btn, idx) => {
                            const isOutline = btn.variant === "secondary" || btn.variant === "outline";
                            return (
                                <a
                                    key={idx}
                                    href={btn.path || btn.href || "#"}
                                    className={
                                        isOutline
                                            ? "px-6 sm:px-8 py-3 text-sm sm:text-base font-semibold border-2 border-white/70 text-white bg-transparent hover:bg-white/10 rounded-md transition-all shadow"
                                            : "px-6 sm:px-8 py-3 text-sm sm:text-base font-semibold bg-accent hover:bg-accent/90 text-white rounded-md transition-all shadow-ct-glow"
                                    }
                                >
                                    {t(btn.label)}
                                </a>
                            );
                        })}
                    </div>
                )}

                {/* Scroll indicator */}
                {props.showScrollIndicator && (
                    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce ct-animate-in ct-delay-4">
                        <div className="w-6 h-10 border-2 border-white/50 rounded-full flex items-start justify-center pt-2">
                            <div className="w-1 h-3 bg-white/70 rounded-full animate-pulse" />
                        </div>
                    </div>
                )}
            </div>
        </section>
    );
}

export default HeroCommuneTransparenteSection;
