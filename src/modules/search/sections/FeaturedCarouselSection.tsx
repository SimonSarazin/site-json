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

  useEffect(() => {
    if (!api || !autoplay || renderable.length <= 1) return;
    const interval = setInterval(() => api.scrollNext(), autoplayIntervalMs);
    return () => clearInterval(interval);
  }, [api, autoplay, autoplayIntervalMs, renderable.length]);

  // Fond FIXE (config-driven, identique clair/sombre) → texte blanc fixe, jamais `text-foreground`
  // (qui s'inverserait en mode clair et deviendrait illisible sur ce fond sombre). Sans `background`
  // configuré, repli sur l'encre du thème pour rester lisible sur le fond de page par défaut.
  const sectionStyle = background ? { backgroundColor: background } : undefined;
  const sectionClassName = background ? "text-white" : "bg-foreground text-background";

  if (!loaded || !entity || (isLoading && renderable.length === 0)) {
    return (
      <section id={id} style={sectionStyle} className={cn("py-16 md:py-24", sectionClassName)}>
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
    <section id={id} style={sectionStyle} className={cn("relative overflow-hidden py-16 md:py-24 py-30 ", sectionClassName)}>
      {/* Badge rendu UNE SEULE fois, en position absolue : contrairement au titre/description/CTA
          (dans `FeaturedCarouselSlide`, qui défilent avec le carrousel), il ne doit pas bouger
          d'une diapositive à l'autre. `container mx-auto px-4 sm:px-8 md:px-24` reproduit
          l'alignement gauche du `Carousel` juste en dessous (même padding responsive), pour que le
          badge tombe pile au-dessus du texte à chaque taille d'écran. */}
      {badgeLabel && (
        <div className="pointer-events-none absolute inset-x-0 top-20 sm:top-10 md:top-16 z-20">
          <div className="container mx-auto px-4 sm:px-8 md:px-24">
            <Badge
              variant={accentColor ? undefined : "secondary"}
              style={accentStyle}
              className="-rotate-4 rounded-none border-none px-3 py-1 sm:px-4 sm:py-1.5 text-2xl sm:text-2xl md:text-5xl font-serif"
            >
              {t(badgeLabel)}
            </Badge>
          </div>
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
              className="absolute top-1/2 left-2 -translate-y-1/2 rounded-none border-none bg-transparent text-current  md:left-4"
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
