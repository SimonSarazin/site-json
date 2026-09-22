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
  // Panneau de contenu : même dégradé que l'illustration de `map-bubbles`, pour deux blocs qui se répondent.
  const voilePanneau = enCarte && props.backgroundOverlay
    ? {
        background: `linear-gradient(${props.backgroundOverlay.angle ?? 90}deg, ${props.backgroundOverlay.from}, ${props.backgroundOverlay.to})`,
        // Encre propre au panneau : elle suit le dégradé, pas l'encre de la carte qui l'entoure.
        ...(props.overlayTextColor ? { color: props.overlayTextColor } : {}),
      }
    : undefined;
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

  // Fond fourni : texte blanc par défaut, jamais `text-foreground` — le fond attendu est sombre et FIXE,
  // l'encre du thème s'y inverserait en mode clair. `textColor` prend le dessus dès que le fond est clair.
  // Sans fond du tout : le couple sombre du thème.
  const sectionStyle = background
    ? { backgroundColor: background, ...(props.textColor ? { color: props.textColor } : {}) }
    : undefined;
  const sectionClassName = background
    ? (props.textColor ? "" : "text-white")
    : "bg-foreground text-background";

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
      // titre, qui déborde du haut, serait coupée. Ses marges calent le panneau sur celui de `map-bubbles`
      // voisin : même marge basse, et en haut la même marge plus la ligne d'accroche que ce bloc porte
      // au-dessus de son illustration.
      className={cn("relative", enCarte ? "rounded-2xl pt-16 pb-6" : "overflow-hidden pt-6 pb-6 md:pt-10 md:pb-10", sectionClassName)}
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
      {/* Avec panneau (`backgroundOverlay`) : le dégradé habille la diapositive ET son pied — points et
          bouton vivent DANS la carte de l'actu. Marge latérale comme l'illustration de `map-bubbles`, pour
          que la carte blanche respire autour ; `flex-1` descend le panneau au bas de la carte, à la hauteur
          de celui du bloc voisin. */}
      <div
        style={voilePanneau}
        // `py-8` : la ligne points + bouton se lit un peu au-dessus du bord bas du panneau, pas collée à lui,
        // et la diapositive respire d'autant sous son bord haut.
        className={cn("flex flex-1 flex-col justify-start", voilePanneau && "mx-4 rounded-2xl px-3 py-8 md:px-4")}
      >
      <Carousel
        opts={{ loop: renderable.length > 1 }}
        setApi={setApi}
        className={cn("container mx-auto", voilePanneau ? "px-0" : "px-4")}
      >
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
      {/* Pied : les points de position au centre, le bouton de la diapositive COURANTE à droite. Le bouton
          vit ici (et non dans la diapositive) pour partager sa ligne avec les points, sans quoi il
          défilerait avec le contenu. */}
      {enCarte && (
        <div className={cn("container mx-auto mt-auto flex flex-col items-center gap-3 pt-4 sm:grid sm:grid-cols-[1fr_auto_1fr] sm:items-center sm:gap-4", voilePanneau ? "px-0" : "px-4")}>
          {/* Colonnes latérales de même largeur : les points restent au CENTRE quelle que soit la largeur
              du bouton. Sous `sm:`, le bouton passe à la ligne — à cette largeur il mordrait sur eux. */}
          <span aria-hidden className="hidden sm:block" />
          <div className="flex justify-center gap-2">
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
          <div className="flex justify-center sm:justify-end">
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
        </div>
      )}
      </div>
    </section>
  );
}

export default FeaturedCarouselSection;
