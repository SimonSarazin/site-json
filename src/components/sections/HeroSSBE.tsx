import { Link } from "react-router";
import { ArrowRight, Users, Building2, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocalization } from "@/hooks/useLocalization";
import { HeroSSBEProps as SchemaHeroSSBEProps } from "@/types/site-schema";

interface HeroSSBEProps {
  id?: string;
  props: SchemaHeroSSBEProps;
}

export function HeroSSBE({ id, props }: HeroSSBEProps) {
  const { t } = useLocalization();

  const backgroundImage = props.backgroundImage;
  const backgroundAlt = props.backgroundImageAlt ? t(props.backgroundImageAlt) : "";

  const primaryCta = props.ctaButtons?.[0];
  const secondaryCta = props.ctaButtons?.[1];

  const badgeLabel =
    props.badges && props.badges.length > 0
      ? t(props.badges[0].label)
      : "Sport Santé Bien-Être à La Réunion";

  const quickAccessTitle = props.quickAccessTitle
    ? t(props.quickAccessTitle)
    : "Accès rapide";

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
          className="absolute inset-0 bg-linear-to-b from-[rgb(0_0_0/0.41)] to-[rgb(0_0_0/0.38)]"
        />
      </div>

      <div className="container relative w-full mx-auto px-4 sm:px-8 lg:px-16 py-16 lg:py-24">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Content */}
          <div className="space-y-8 animate-fade-up max-w-xl">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-background/20 backdrop-blur-sm text-sm font-medium border border-background/20">
              <Activity className="h-4 w-4" />
              {badgeLabel}
            </div>

            <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold leading-tight">
              {t(props.headline)}
            </h1>

            {props.subhead && (
              <p className="text-lg  leading-relaxed max-w-xl">
                {t(props.subhead)}
              </p>
            )}

            {(primaryCta || secondaryCta) && (
              <div className="flex flex-wrap gap-4">
                {primaryCta && (
                  <Button
                    size="lg"
                    className="bg-primary hover:opacity-90 shadow-glow text-primary-foreground"
                    asChild
                  >
                    <Link to={primaryCta.path || "#"}>
                      {t(primaryCta.label)}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                )}

                {secondaryCta && (
                  <Button
                    size="lg"
                    variant="outline"
                    className="border-background/40 text-background hover:bg-background/10 hover:text-background"
                    asChild
                  >
                    <Link to={secondaryCta.path || "#"}>{t(secondaryCta.label)}</Link>
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Quick Access Cards */}
          {quickAccessCards.length > 0 && (
            <div className="space-y-4 lg:pl-8 max-w-xl lg:max-w-none">
              <h2 className="font-display text-xl font-semibold mb-6 text-background">
                {quickAccessTitle}
              </h2>

              {quickAccessCards.map((card, index) => {
                
                const IconComponent =
                  card.icon === "building2"
                    ? Building2
                    : card.icon === "users"
                      ? Users
                      : index % 2 === 0
                        ? Users
                        : Building2;

                return (
                  <Link key={index} to={card.path} className="block">
                    <div className={`group relative overflow-hidden rounded-3xl bg-linear-to-r p-6 md:p-8 shadow-xl border border-white/10 text-background`}>
                      <div className="flex items-start justify-between">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <IconComponent className="h-5 w-5" />
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
