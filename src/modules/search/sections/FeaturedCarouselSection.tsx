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
import FeaturedCarouselCta from "./FeaturedCarouselCta";
import type { FeaturedCarouselSectionProps } from "../schema";
import "@/modules/search/i18n";
import { accentStyle } from "@/lib/accentStyle";
import { sectionBadgeClass } from "@/components/sections/sectionBadge";

export interface FeaturedCarouselSectionWrapperProps {
  id?: string;
  props: FeaturedCarouselSectionProps;
}

export function FeaturedCarouselSection({ id, props }: FeaturedCarouselSectionWrapperProps) {
  const { loaded } = useLoadNamespace("modules/search");
  const { entity } = useCocolight();
  const t = useT();
  const { badgeLabel, ctaLabel, baseParams, resource, itemAction = { kind: "profil" }, autoplay, autoplayIntervalMs, background, accentColor, accentTextColor, showControls, design } = props;
  const enCarte = design === "card";
  // Le badge peut se teinter à part du bouton (`badgeColor`), sinon il suit l'accent.
  const styleBadge = accentStyle(props.badgeColor ?? accentColor, props.badgeTextColor ?? accentTextColor);

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
      <section id={id} style={sectionStyle} className={cn(enCarte && "relative rounded-2xl", "py-6 md:py-10", sectionClassName)}>
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
      // Habillage « carte » : la section porte ses propres coins et ne rogne plus — sinon la pilule de
      // titre, qui déborde du haut, serait coupée.
      // En habillage « carte », même marge basse que le bloc voisin (`pb-6`) : le pied de carte se lit
      // alors à la hauteur du bas de son illustration.
      className={cn("relative pt-6 md:pt-10", enCarte ? "rounded-2xl pb-6" : "overflow-hidden pb-6 md:pb-10", sectionClassName)}
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
        <div className={enCarte ? "absolute -top-5 left-6 z-20" : "container mx-auto px-4 mb-2 md:mb-3"}>
          <Badge
            variant={styleBadge ? undefined : "secondary"}
            style={styleBadge}
            className={sectionBadgeClass(props.headlineStyle)}
          >
            {t(badgeLabel)}
          </Badge>
        </div>
      )}
      {/* Le carrousel se centre dans la place RESTANTE, sous un badge qui, lui, reste en haut. Sans ce
          niveau, un `justify-center` posé sur la section centrait badge ET carrousel d'un bloc, et le
          badge descendait — désaligné de la pastille du bloc voisin, à hauteur de laquelle il doit se
          lire. `flex-1` n'agit que si la section est en flex-col contrainte (colonne de `gridLayout`) ;
          ailleurs il est inerte, le rendu ne bouge pas. */}
      <div className="flex flex-1 flex-col justify-start">
      <Carousel opts={{ loop: renderable.length > 1 }} setApi={setApi} className="container mx-auto px-4">
        <CarouselContent>
          {renderable.map((item, index) => (
            <CarouselItem key={getEntryId(item) ?? index}>
              <FeaturedCarouselSlide
                item={item}
                ctaLabel={ctaLabel}
                resource={resource}
                itemAction={itemAction}
                accentColor={accentColor}
                accentTextColor={accentTextColor}
                enCarte={enCarte}
                priority={index === 0}
              />
            </CarouselItem>
          ))}
        </CarouselContent>
        {renderable.length > 1 && (
          <>
            {/* Habillage « carte » : pas de flèches — les points suffisent, et la carte reste calme. */}
            {!enCarte && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Diapositive précédente"
                  onClick={() => api?.scrollPrev()}
                  className="absolute top-[28%] left-0 -translate-y-1/2 rounded-none border-none bg-transparent text-current hover:bg-current/10 md:left-1"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Diapositive suivante"
                  onClick={() => api?.scrollNext()}
                  className="absolute top-[28%] right-0 -translate-y-1/2 rounded-none border-none bg-transparent text-current hover:bg-current/10 md:right-1"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </>
            )}
            {showControls && !enCarte && (
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
      {/* Pied de la carte : les points de position à gauche, le bouton de la diapositive COURANTE à
          droite — une seule ligne, comme la maquette. Le bouton vit ici (et non dans la diapositive)
          pour partager sa ligne avec les points, sans quoi il défilerait avec le contenu. */}
      {enCarte && (
        <div className="container mx-auto mt-auto flex items-center justify-between gap-4 px-4 pt-4">
          <div className="flex gap-2">
            {renderable.length > 1 &&
              renderable.map((item, index) => (
                <button
                  key={getEntryId(item) ?? index}
                  type="button"
                  aria-label={`Diapositive ${index + 1}`}
                  onClick={() => api?.scrollTo(index)}
                  className={cn(
                    "h-2 w-2 rounded-full transition-colors",
                    index === selectedIndex ? "bg-current" : "bg-current/30",
                  )}
                />
              ))}
          </div>
          {renderable[selectedIndex] && (
            <FeaturedCarouselCta
              item={renderable[selectedIndex]}
              ctaLabel={ctaLabel}
              itemAction={itemAction}
              accentColor={accentColor}
              accentTextColor={accentTextColor}
              compact
            />
          )}
        </div>
      )}
      </div>
    </section>
  );
}

export default FeaturedCarouselSection;
