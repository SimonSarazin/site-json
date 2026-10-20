import { useLocalization } from "@/hooks/useLocalization";
import { HeroTintedOverlayProps } from "@/types/site-schema";
import { HeroBackgroundImage } from "./HeroBackgroundImage";

interface HeroTintedOverlayComponentProps {
    id?: string;
    props: HeroTintedOverlayProps;
}

export function HeroTintedOverlay({ id, props }: HeroTintedOverlayComponentProps) {
    const { t } = useLocalization();
    /**
     * L'image ET le voile ne sont rendus QUE si `backgroundImage` est fourni.
     * Sans image, un texte blanc se poserait donc sur le fond de page — invisible
     * sur un thème clair. On retombe alors sur l'encre du thème, sans ombre portée
     * (inutile hors photo). Classes écrites en toutes lettres : Tailwind scanne les
     * sources, une classe construite à l'exécution serait purgée du build de prod.
     *
     * `hero-text-shadow(-strong)` plutôt que `drop-shadow`/`drop-shadow-lg` : ces
     * utilitaires Tailwind plafonnent à 0,15 d'opacité — pensés pour l'élévation
     * d'une carte, pas pour garantir la lecture d'un titre blanc sur une photo
     * claire (ciel, plage au soleil…). Cf. `shared.css` pour le détail.
     */
    const hasImage = Boolean(props.backgroundImage);
    const inkStrong = hasImage ? "text-white hero-text-shadow-strong" : "text-foreground";
    const ink = hasImage ? "text-white hero-text-shadow" : "text-foreground";
    // Overlay vert et contenu centré
    return (
        <section id={id} className="relative min-h-screen flex items-center justify-center overflow-hidden">
            {/* Image de fond */}
            {props.backgroundImage && (
                <>
                    <HeroBackgroundImage
                        src={props.backgroundImage}
                        alt={props.backgroundImageAlt ? t(props.backgroundImageAlt) : ""}
                        className="absolute inset-0 w-full h-full object-cover z-0"
                        style={{ minHeight: '100vh', maxHeight: 'none' }}
                        priority
                    />
                    {/* Overlay vert translucide */}
                    <div className="absolute inset-0 bg-hero-tint z-10" />
                </>
            )}
            {/* Contenu centré */}  
            <div className="relative z-20 w-full flex flex-col items-center justify-center text-center px-4 gap-6 sm:gap-8 md:gap-10">
                {/* Badge centré en haut.
                    Tokens plutôt que `bg-white`/`text-green-900` en dur (règle « tokens
                    d'abord ») : `card`/`card-foreground` s'inversent avec le thème, donc
                    la pastille reste lisible en mode sombre — où un aplat blanc était une
                    anomalie. En mode clair, `--card` vaut blanc : rendu quasi inchangé. */}
                {props.badge && (
                    <div className="mt-8 sm:mt-12 mb-6 sm:mb-8 flex justify-center">
                        <span className="bg-card/80 text-card-foreground px-4 sm:px-6 py-2 rounded-full text-sm sm:text-base font-medium shadow border border-border/60">
                            {t(props.badge)}
                        </span>
                    </div>
                )}
                {/* Headline */}
                {props.headline && (
                    <h1 className={`${inkStrong} text-3xl sm:text-5xl md:text-7xl font-extrabold mb-6 sm:mb-8`}>
                        {t(props.headline)}
                    </h1>
                )}
                {/* Subhead */}
                {props.subhead && (
                    <div className={`${ink} text-base sm:text-lg md:text-2xl font-light mb-6 sm:mb-10`}>
                        {t(props.subhead)}
                    </div>
                )}
                {/* Tagline */}
                {props.tagline && (
                    <div className={`${ink} text-xl sm:text-2xl md:text-4xl font-bold mb-6 sm:mb-8`}>
                        {t(props.tagline)}
                    </div>
                )}
                {/* Tagline subtext */}
                {props.taglineSubtext && (
                    <div className={`${ink} text-sm sm:text-base md:text-xl font-normal mb-8 sm:mb-12 mx-4 sm:mx-8 md:mx-32`}>
                        {t(props.taglineSubtext)}
                    </div>
                )}
                {/* CTA bouton — l'indicateur de défilement suit, hors de cette colonne */}
                {props.ctaButtons && props.ctaButtons.length > 0 && (
                    <div className="flex justify-center mt-2 sm:mt-4">
                        {props.ctaButtons.map((btn, idx) => (
                            <a
                                key={idx}
                                href={btn.path}
                                className="px-6 sm:px-8 py-2 sm:py-3 bg-card/80 text-card-foreground font-semibold rounded-md text-base sm:text-lg shadow hover:bg-card transition-all border border-border/60"
                            >
                                {t(btn.label)}
                            </a>
                        ))}
                    </div>
                )}
            </div>
            {/*
              Indicateur de défilement — même visuel que HeroParallax:184 et
              HeroEntityBanner:133, la teinte suivant la présence d'image (cf. `ink`).

              `prefers-reduced-motion` : le rebond est figé par le plancher global
              (`shared.css`, qui nomme `.animate-bounce` depuis le 2026-07-29). Le point
              pulsant, lui, est gardé ICI en `motion-safe:` — `animate-pulse` compte 27
              emplois dans src/, en majorité des squelettes de chargement où l'animation
              porte l'information : on ne pouvait donc pas la couper globalement.
            */}
            {props.showScrollIndicator && (
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 animate-bounce pointer-events-none">
                    <div className={`w-6 h-10 border-2 rounded-full flex items-start justify-center p-2 ${hasImage ? "border-white/50" : "border-primary/50"}`}>
                        <div className={`w-1 h-3 rounded-full motion-safe:animate-pulse ${hasImage ? "bg-white/70" : "bg-primary"}`} />
                    </div>
                </div>
            )}
        </section>
    );
}

export default HeroTintedOverlay;