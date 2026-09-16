import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCocolight } from "@/hooks/useCocolight";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { useT } from "@/hooks/useT";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from "@/components/ui/carousel";
import { cn } from "@/lib/utils";
import { useSearchQuery } from "../hooks/useSearchQuery";
import { hasRenderableTitle } from "../lib/featuredCarouselFilters";
import { getEntryId } from "../lib/searchMapSelection";
import FeaturedCarouselSlide from "./FeaturedCarouselSlide";
import type { FeaturedCarouselSectionProps } from "../schema";
import "@/modules/search/i18n";

export interface FeaturedCarouselSectionWrapperProps {
  id?: string;
  props: FeaturedCarouselSectionProps;
}

export function FeaturedCarouselSection({ id, props }: FeaturedCarouselSectionWrapperProps) {
  const { loaded } = useLoadNamespace("modules/search");
  const { entity } = useCocolight();
  const t = useT();
  const { badgeLabel, ctaLabel, baseParams, resource, itemAction = { kind: "profil" }, autoplay, autoplayIntervalMs, background, accentColor, showControls } = props;
  // `accentColor` config-driven (badge) — même couple fond fixe/texte blanc fixe que sur les CTA
  // des diapositives (`FeaturedCarouselSlide`), indépendant du thème.
  const accentStyle = accentColor ? { backgroundColor: accentColor, color: "#fff" } : undefined;

  const [searchType] = useState<Record<string, string[]> | null>(
    baseParams.defaultTypes ? { type: baseParams.defaultTypes } : null
  );

  const { transformedResults, isLoading } = useSearchQuery({
    queryKeyPrefix: `featured-carousel-${id ?? "default"}`,
    searchText: "",
    searchTags: {},
    searchType,
    mapUsed: false,
    baseParams,
  });

  const renderable = transformedResults.filter((item) => hasRenderableTitle(item, resource));

  const [api, setApi] = useState<CarouselApi>();
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    if (!api) return;
    const onSelect = () => setSelectedIndex(api.selectedScrollSnap());
    onSelect();
    api.on("select", onSelect);
    return () => {
      api.off("select", onSelect);
    };
  }, [api]);

  // Autoplay suspendu au survol/focus (le temps de lire ou de cliquer) et
  // désactivé si l'utilisateur demande moins d'animations (prefers-reduced-motion).
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (!api || !autoplay || paused || renderable.length <= 1) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const interval = setInterval(() => api.scrollNext(), autoplayIntervalMs);
    return () => clearInterval(interval);
  }, [api, autoplay, paused, autoplayIntervalMs, renderable.length]);

  // Fond FIXE (config-driven, identique clair/sombre) → texte blanc fixe, jamais `text-foreground`
  // (qui s'inverserait en mode clair et deviendrait illisible sur ce fond sombre). Sans `background`
  // configuré, repli sur l'encre du thème pour rester lisible sur le fond de page par défaut.
  const sectionStyle = background ? { backgroundColor: background } : undefined;
  const sectionClassName = background ? "text-white" : "bg-foreground text-background";

  if (!loaded || !entity || (isLoading && renderable.length === 0)) {
    return (
      <section id={id} style={sectionStyle} className={cn("py-6 md:py-10", sectionClassName)}>
        <div className="container mx-auto animate-pulse px-4">
          <div className="grid items-center gap-8 md:grid-cols-2">
            <div className="space-y-4">
              <div className="h-6 w-32 rounded-full bg-current/20" />
              <div className="h-8 w-3/4 rounded bg-current/20" />
              <div className="h-16 w-full rounded bg-current/10" />
            </div>
            <div className="aspect-[4/3] w-full rounded-2xl bg-current/10" />
          </div>
        </div>
      </section>
    );
  }

  // Rien à mettre en une (aucun résultat, ou tag pas encore posé côté contenu) → section invisible,
  // jamais de bandeau vide en prod.
  if (renderable.length === 0) return null;

  return (
    <section
      id={id}
      style={sectionStyle}
      className={cn("relative overflow-hidden py-6 md:py-10", sectionClassName)}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      {/* Badge rendu UNE SEULE fois (hors des diapositives : il ne bouge pas d'une
          slide à l'autre), DANS LE FLUX au-dessus du carrousel — même `container`/
          padding que lui, donc même alignement gauche que le texte des diapositives.
          En position absolue (version précédente), il chevauchait le titre dès que
          celui-ci était long, ou que l'image manquait (la colonne texte, centrée
          verticalement, remontait dessous) : en flux, sa place est réservée par
          construction quelle que soit la hauteur du contenu. */}
      {badgeLabel && (
        <div className="container mx-auto px-4 sm:px-8 md:px-24 mb-3 md:mb-6">
          <Badge
            variant={accentColor ? undefined : "secondary"}
            style={accentStyle}
            className="-rotate-4 rounded-none border-none px-3 py-1 sm:px-4 sm:py-1.5 text-xl sm:text-2xl md:text-3xl font-serif"
          >
            {t(badgeLabel)}
          </Badge>
        </div>
      )}
      <Carousel opts={{ loop: renderable.length > 1 }} setApi={setApi} className="container mx-auto px-4 sm:px-8 md:px-24">
        <CarouselContent>
          {renderable.map((item, index) => (
            <CarouselItem key={getEntryId(item) ?? index}>
              <FeaturedCarouselSlide
                item={item}
                ctaLabel={ctaLabel}
                resource={resource}
                itemAction={itemAction}
                accentColor={accentColor}
                priority={index === 0}
              />
            </CarouselItem>
          ))}
        </CarouselContent>
        {renderable.length > 1 && (
          <>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Diapositive précédente"
              onClick={() => api?.scrollPrev()}
              className="absolute top-1/2 left-2 -translate-y-1/2 rounded-none border-none bg-transparent text-current hover:bg-current/10 md:left-4"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Diapositive suivante"
              onClick={() => api?.scrollNext()}
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded-none border-none bg-transparent text-current hover:bg-current/10 md:right-4"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            {showControls && (
              <div className="mt-6 flex justify-center gap-2">
                {renderable.map((item, index) => (
                  <button
                    key={getEntryId(item) ?? index}
                    type="button"
                    aria-label={`Diapositive ${index + 1}`}
                    onClick={() => api?.scrollTo(index)}
                    className={cn(
                      "h-2 w-2 rounded-full transition-colors",
                      index === selectedIndex ? "bg-current" : "bg-current/30"
                    )}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </Carousel>
    </section>
  );
}

export default FeaturedCarouselSection;
