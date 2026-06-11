import { useLocalization } from "@/hooks/useLocalization";
import { HeroTintedOverlayProps } from "@/types/site-schema";

interface HeroTintedOverlayComponentProps {
    id?: string;
    props: HeroTintedOverlayProps;
}

export function HeroTintedOverlay({ props }: HeroTintedOverlayComponentProps) {
    const { t } = useLocalization();
    // Overlay vert et contenu centré
    return (
        <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
            {/* Image de fond */}
            {props.backgroundImage && (
                <>
                    <img
                        src={props.backgroundImage}
                        alt={props.backgroundImageAlt ? t(props.backgroundImageAlt) : ""}
                        className="absolute inset-0 w-full h-full object-cover z-0"
                        style={{ minHeight: '100vh', maxHeight: 'none' }}
                    />
                    {/* Overlay vert translucide */}
                    <div className="absolute inset-0 bg-banner-green z-10" />
                </>
            )}
            {/* Contenu centré */}  
            <div className="relative z-20 w-full flex flex-col items-center justify-center text-center px-4 gap-6 sm:gap-8 md:gap-10">
                {/* Badge centré en haut */}
                {props.badge && (
                    <div className="mt-8 sm:mt-12 mb-6 sm:mb-8 flex justify-center">
                        <span className="bg-white/80 text-green-900 px-4 sm:px-6 py-2 rounded-full text-sm sm:text-base font-medium shadow border border-white/60">
                            {t(props.badge)}
                        </span>
                    </div>
                )}
                {/* Headline */}
                {props.headline && (
                    <h1 className="text-white text-3xl sm:text-5xl md:text-7xl font-extrabold mb-6 sm:mb-8 drop-shadow-lg">
                        {t(props.headline)}
                    </h1>
                )}
                {/* Subhead */}
                {props.subhead && (
                    <div className="text-white text-base sm:text-lg md:text-2xl font-light mb-6 sm:mb-10 drop-shadow">
                        {t(props.subhead)}
                    </div>
                )}
                {/* Tagline */}
                {props.tagline && (
                    <div className="text-white text-xl sm:text-2xl md:text-4xl font-bold mb-6 sm:mb-8 drop-shadow">
                        {t(props.tagline)}
                    </div>
                )}
                {/* Tagline subtext */}
                {props.taglineSubtext && (
                    <div className="text-white text-sm sm:text-base md:text-xl font-normal mb-8 sm:mb-12 drop-shadow mx-4 sm:mx-8 md:mx-32">
                        {t(props.taglineSubtext)}
                    </div>
                )}
                {/* CTA bouton */}
                {props.ctaButtons && props.ctaButtons.length > 0 && (
                    <div className="flex justify-center mt-2 sm:mt-4">
                        {props.ctaButtons.map((btn, idx) => (
                            <a
                                key={idx}
                                href={btn.path}
                                className="px-6 sm:px-8 py-2 sm:py-3 bg-white/80 text-green-900 font-semibold rounded-md text-base sm:text-lg shadow hover:bg-white transition-all border border-white/60"
                            >
                                {t(btn.label)}
                            </a>
                        ))}
                    </div>
                )}
            </div>
        </section>
    );
}

export default HeroTintedOverlay;