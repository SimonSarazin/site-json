import { Link } from "react-router";
import { useLocalization } from "@/hooks/useLocalization";
import { LocalizedString } from "@/types/site-schema";
import { ArrowRight } from "lucide-react";

type HeroButtonVariant = "default" | "secondary" | "accent";

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
  label: LocalizedString;
  title: LocalizedString;
  description: LocalizedString;
  icon?: string;
}

interface HeroSSBESectionProps {
  headline: LocalizedString;
  subhead?: LocalizedString;
  backgroundImage?: string;
  backgroundImageAlt?: LocalizedString;
  overlayOpacity?: string;
  badges?: HeroBadge[];
  ctaButtons?: HeroCtaButton[];
  quickAccessTitle?: LocalizedString;
  quickAccessCards?: HeroQuickAccessCard[];
}

interface HeroSSBEProps {
  id?: string;
  props: HeroSSBESectionProps;
}

export function HeroSSBE({ id, props }: HeroSSBEProps) {
  const { t } = useLocalization();
  const overlayOpacity = props.overlayOpacity;

  const backgroundImage = props.backgroundImage;
  const backgroundAlt = props.backgroundImageAlt ? t(props.backgroundImageAlt) : "";

  const getButtonClasses = (btnVariant?: "default" | "secondary" | "accent") => {
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
          <img
            src={backgroundImage}
            alt={backgroundAlt}
            className="w-full h-full object-cover"
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

              {quickAccessCards.map((card, index) => {
                  const cardVariant = index % 2 === 0 ? "public" : "pro";

                return (
                  <Link key={index} to={card.path} className="block">
                    <div className={`access-card access-card-${cardVariant} group backdrop-blur-sm`}>
                      <div className="flex items-start justify-between">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            {card.icon && (
                              <span
                                  className={`w-5 h-5`}
                                  dangerouslySetInnerHTML={{ __html: card.icon }}
                              />
                            )}
                            <span className="text-sm font-medium opacity-90">
                              {t(card.label)}
                            </span>
                          </div>
                          <h3 className="font-display text-2xl font-bold">
                            {t(card.title)}
                          </h3>
                          <p className="text-sm opacity-90 max-w-xs">
                            {t(card.description)}
                          </p>
                        </div>
                        <ArrowRight className="h-6 w-6 transition-transform group-hover:translate-x-1" />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default HeroSSBE;
