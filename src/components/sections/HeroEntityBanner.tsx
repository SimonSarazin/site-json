import { useCocolight } from "@/hooks/useCocolight";
import { useLocalization } from "@/hooks/useLocalization";
import type { HeroEntityBannerProps } from "@/types/site-schema";
import { DynamicIcon, type IconName } from "lucide-react/dynamic";

interface HeroEntityBannerComponentProps {
    id?: string;
    props: HeroEntityBannerProps;
}

interface DonneEntity {
    name?: string;
    bannerImageUrl?: string;
    bannerLogoUrl?: string;
    bannerText?: string;
}

/** Base par défaut des médias d'entité (chemins relatifs du costum Communecter). */
const DEFAULT_MEDIA_BASE_URL = "https://www.communecter.org";

export function HeroEntityBanner({ id, props }: HeroEntityBannerComponentProps) {
    const { t } = useLocalization();
    const { entity } = useCocolight();

    const data = entity?.serverData;
    const dataCostum = entity?.serverData?.costum as Record<string, unknown> | undefined;

    const mediaBaseUrl = props.mediaBaseUrl ?? DEFAULT_MEDIA_BASE_URL;

    // Média sourcé de l'entité : chemin relatif plateforme → préfixé par
    // `mediaBaseUrl` ; URL absolue → telle quelle. Le fallback config
    // (asset local du site) n'est JAMAIS préfixé.
    const resolveEntityMedia = (entityUrl: unknown, fallback?: string): string | undefined => {
        const fromEntity = typeof entityUrl === "string" && entityUrl.length > 0 ? entityUrl : undefined;
        if (fromEntity) {
            return /^https?:\/\//.test(fromEntity) ? fromEntity : `${mediaBaseUrl}${fromEntity}`;
        }
        return fallback;
    };

    const donneEntity: DonneEntity = {
        // Contenu sourcé de l'entité Cocolight, replis sur les props config.
        name: data?.name || t(props.headline),
        bannerImageUrl: resolveEntityMedia(dataCostum?.bannerImageUrl, props.backgroundImage),
        bannerLogoUrl: resolveEntityMedia(dataCostum?.bannerLogoUrl, props.logoImage),
        bannerText: (dataCostum?.bannerText as string | undefined) || (props.subhead ? t(props.subhead) : undefined),
    }

    return (
        <section id={id} className="relative min-h-screen flex flex-col overflow-hidden">
            {/* ── Image de fond ── */}
            {donneEntity.bannerImageUrl && (
                <>
                    <img
                        src={donneEntity.bannerImageUrl}
                        alt={props.backgroundImageAlt ? t(props.backgroundImageAlt) : ""}
                        className="absolute inset-0 w-full h-full object-cover z-0"
                    />
                    {/* Overlay violet sombre dégradé, fidèle à l'image */}
                    <div className="absolute inset-0 z-10 bg-hero-tint" />
                    <div className="absolute inset-0 z-10 bg-linear-to-b from-black/20 via-transparent to-black/40" />
                </>
            )}

            {/* ── Contenu centré ── */}
            <div className="relative z-20 flex flex-col items-center justify-center flex-1 text-center px-4 pt-28 pb-16">

                {donneEntity.bannerLogoUrl && (
                    <img
                        src={donneEntity.bannerLogoUrl}
                        alt="logo"
                        className="h-24 w-auto mb-16 object-contain animate-in fade-in slide-in-from-bottom-4 duration-600 delay-100"
                    />
                )}

                {/* Headline */}
                {donneEntity.name && (
                    <h1 className="text-white text-3xl sm:text-5xl md:text-6xl font-extrabold mb-16 drop-shadow-lg animate-in fade-in slide-in-from-bottom-4 duration-600 delay-[250ms] leading-tight">
                        {donneEntity.name}
                    </h1>
                )}

                {/* Subhead */}
                {donneEntity.bannerText && (
                    <p className="text-white/90 text-base sm:text-lg md:text-2xl font-semibold mb-16 drop-shadow max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-600 delay-[400ms]">
                        {donneEntity.bannerText}
                    </p>
                )}

                {/* Badges / Features horizontaux */}
                {props.badges && props.badges.length > 0 && (
                    <div className="flex flex-wrap justify-center gap-3 mb-10 animate-in fade-in slide-in-from-bottom-4 duration-600 delay-[400ms]">
                        {props.badges.map((badge, idx) => (
                            <span
                                key={idx}
                                className="flex items-center gap-2 bg-white/30 border border-white/40 backdrop-blur-sm text-white text-sm font-semibold px-4 py-2 rounded-full shadow"
                            >
                                {badge.icon && (
                                    <DynamicIcon name={badge.icon as IconName} className="w-4 h-4 shrink-0" />
                                )}
                                <a href={badge.href || "#"}>
                                    {t(badge.label)}
                                </a>
                            </span>
                        ))}
                    </div>
                )}

                {/* CTA Buttons */}
                {props.ctaButtons && props.ctaButtons.length > 0 && (
                    <div className="flex flex-wrap justify-center gap-4 animate-in fade-in slide-in-from-bottom-4 duration-600 delay-[550ms]">
                        {props.ctaButtons.map((btn, idx) => {
                            const isOutline = btn.variant === "secondary" || btn.variant === "outline";
                            return (
                                <a
                                    key={idx}
                                    // href={btn.path || btn.href || "#"}
                                    className={
                                        isOutline
                                            ? "px-6 sm:px-8 py-3 text-sm sm:text-base font-semibold border-2 border-white/70 text-white bg-transparent hover:bg-white/10 rounded-md transition-all shadow"
                                            : "px-6 sm:px-8 py-3 text-sm sm:text-base font-semibold bg-accent hover:bg-accent/90 text-white rounded-md transition-all shadow-glow"
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
                    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce animate-in fade-in slide-in-from-bottom-4 duration-600 delay-[550ms]">
                        <div className="w-6 h-10 border-2 border-white/50 rounded-full flex items-start justify-center pt-2">
                            <div className="w-1 h-3 bg-white/70 rounded-full animate-pulse" />
                        </div>
                    </div>
                )}
            </div>
        </section>
    );
}

export default HeroEntityBanner;
