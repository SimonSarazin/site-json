import { Link } from "react-router";
import { useLocalization } from "@/hooks/useLocalization";
import { LocalizedString } from "@/types/site-schema";
import { ArrowRight } from "lucide-react";
import { HeroBackgroundImage } from "./HeroBackgroundImage";

type HeroButtonVariant = "default" | "secondary" | "accent" | "primary" | "outline";

interface HeroBadge {
  label: LocalizedString;
  icon?: string;
}

interface HeroCtaButton {
  label: LocalizedString;
  path?: string;
  variant?: HeroButtonVariant;
}

interface HeroQuickAccessCard {
  path: string;
  // Optionnels : rendus conditionnellement (`card.title && …`) ; certaines configs
  // (ex. equipements-Sportifs) déclarent des cartes-raccourci label + path + icon seuls.
  label?: LocalizedString;
  title?: LocalizedString;
  description?: LocalizedString;
  icon?: string;
}

interface HeroQuickAccessSectionProps {
  headline: LocalizedString;
  subhead?: LocalizedString;
  backgroundImage?: string;
  backgroundImageAlt?: LocalizedString;
  backgroundImageMobile?: string;
  backgroundPosition?: string;
  overlayOpacity?: string;
  badges?: HeroBadge[];
  ctaButtons?: HeroCtaButton[];
  quickAccessTitle?: LocalizedString;
  quickAccessCards?: HeroQuickAccessCard[];
}

interface HeroQuickAccessProps {
  id?: string;
  props: HeroQuickAccessSectionProps;
}

export function HeroQuickAccess({ id, props }: HeroQuickAccessProps) {
  const { t } = useLocalization();
  const overlayOpacity = props.overlayOpacity;

  const backgroundImage = props.backgroundImage;
  const backgroundAlt = props.backgroundImageAlt ? t(props.backgroundImageAlt) : "";

  const getButtonClasses = (btnVariant?: HeroButtonVariant) => {
    if (btnVariant === "secondary") {
        return "px-8 py-4 text-lg font-medium border-2 border-foreground/50 bg-secondary/20 backdrop-blur-sm hover:bg-secondary/40 text-foreground rounded-md transition-all";
    }
    if (btnVariant === "accent") {
        return "px-8 py-4 text-lg font-medium bg-accent hover:bg-accent/90 text-accent-foreground rounded-md shadow-lg hover:shadow-xl transition-all";
    }
    return "px-8 py-4 text-lg font-medium bg-primary hover:bg-primary/90 text-primary-foreground rounded-md shadow-lg hover:shadow-xl transition-all";
  };
  const quickAccessCards = props.quickAccessCards ?? [];

  return (
    <section id={id} className="relative overflow-hidden">
      {/* Background Image with overlay */}
      <div className="absolute inset-0">
        {backgroundImage && (
          <HeroBackgroundImage
            src={backgroundImage}
            mobileSrc={props.backgroundImageMobile}
            position={props.backgroundPosition}
            priority
            alt={backgroundAlt}
          />
        )}
        <div
          className="absolute inset-0 "
          style={{
              background: `linear-gradient(to bottom, color-mix(in oklch, var(--color-background) 60%, transparent), color-mix(in oklch, var(--color-background) ${overlayOpacity ?? "30%"}, transparent), var(--color-background))`
          }}
        />
      </div>

      <div className="container relative w-full mx-auto px-4 sm:px-8 lg:px-16 py-16 lg:py-24">
        <div className={(props.quickAccessCards ? " grid lg:grid-cols-2" : " lg:grid-cols-1") + " gap-12 items-center"}>
          {/* Content */}
          <div className={"space-y-8 animate-fade-up"+ (props.quickAccessCards ? " max-w-xl" : " max-w-4xl")}>

            {props.badges && props.badges.length > 0 && (
              <div className="gap-4 pt-8">
                {props.badges.map((badge, idx) => (
                    <div
                        key={idx}
                        className={`inline-flex items-center gap-2 px-4 py-2 rounded-full bg-background/20 backdrop-blur-sm text-sm font-medium border border-foreground/20  text-foreground`}
                    >
                        {badge.icon && (
                            <span
                                className={`w-5 h-5`}
                                dangerouslySetInnerHTML={{ __html: badge.icon }}
                            />
                        )}
                        <span className="text-sm font-medium">{t(badge.label)}</span>
                    </div>
                ))}
                </div>
            )}



            <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold leading-tight">
              {t(props.headline)}
            </h1>

            {props.subhead && (
              <p className="text-lg  leading-relaxed max-w-xl">
                {t(props.subhead)}
              </p>
            )}

            {props.ctaButtons && props.ctaButtons.length > 0 && (
                <div className="flex flex-wrap gap-4">
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

          {/* Quick Access Cards */}
          {quickAccessCards.length > 0 && (
            <div className="space-y-4 lg:pl-8 max-w-xl lg:max-w-none">
              {props.quickAccessTitle && (
                <h2 className="font-display text-xl font-semibold mb-6 text-foreground">
                  {t(props.quickAccessTitle)}
                </h2>
              )}

              <div className={quickAccessCards.length > 3 ? "grid grid-cols-1 sm:grid-cols-2 gap-4" : "space-y-4"}>
              {quickAccessCards.map((card, index) => {
                  const cardVariant = index % 2 === 0 ? "public" : "pro";

                return (
                  <Link key={index} to={card.path} className="block">
                    <div className={`access-card access-card-${cardVariant} group backdrop-blur-sm p-5`}>
                      <div className="flex items-start justify-between">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            {card.icon && (
                              <span
                                  className={`w-5 h-5`}
                                  dangerouslySetInnerHTML={{ __html: card.icon }}
                              />
                            )}
                            {card.label && (
                              <span className="text-sm font-medium opacity-90">
                                {t(card.label)}
                              </span>
                            )}
                          </div>
                          {card.title && (
                            <h3 className="font-display text-2xl font-bold">
                              {t(card.title)}
                            </h3>
                          )}
                          {card.description && (
                            <p className="text-sm opacity-90 max-w-xs">
                              {t(card.description)}
                            </p>
                          )}
                        </div>
                        <ArrowRight className="h-6 w-6 transition-transform group-hover:translate-x-1" />
                      </div>
                    </div>
                  </Link>
                );
              })}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default HeroQuickAccess;
