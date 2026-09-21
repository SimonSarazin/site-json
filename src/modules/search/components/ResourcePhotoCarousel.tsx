import { useEffect, useState } from "react";
import { Images } from "lucide-react";
import { OptimizedImage } from "@/components/ui/OptimizedImage";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel";
import { cn } from "@/lib/utils";

/**
 * Photos d'une ressource / d'une salle (annuaire `coform-resource-directory`) :
 * image seule si 1, **carrousel** (embla) si plusieurs. Jamais cliquable / pas de
 * lightbox — comme le carousel bootstrap du legacy `tlCardRessourcePanelHtml` /
 * `navigator.ressource.preview`.
 *
 * `controls` : `"arrows"` (défaut, modal) affiche les flèches préc./suiv. ;
 * `"none"` (carte) les masque. `autoPlay` fait défiler seul (4 s), en pause au
 * survol — sans dépendance (`embla-carousel-autoplay` n'est pas installé).
 *
 * Hauteur FIXE (`heightClass`) posée sur `CarouselContent` + `CarouselItem` : le
 * conteneur embla (`overflow-hidden`) n'a pas de hauteur propre.
 */
export function ResourcePhotoCarousel({
  images,
  alt,
  heightClass,
  fallback,
  arrowSize = "sm",
  controls = "arrows",
  autoPlay = false,
  overlay,
}: {
  images: string[];
  alt?: string;
  heightClass: string;
  fallback?: React.ReactNode;
  arrowSize?: "sm" | "lg";
  /** Flèches préc./suiv. — masquées sur la carte (`"none"`). */
  controls?: "arrows" | "none";
  /** Défilement automatique (carte). */
  autoPlay?: boolean;
  /** Contenu superposé (badges, dégradé…) — rendu au-dessus de l'image. */
  overlay?: React.ReactNode;
}) {
  const [api, setApi] = useState<CarouselApi>();
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (!api || !autoPlay || paused || images.length < 2) return;
    const id = window.setInterval(() => api.scrollNext(), 4000);
    return () => window.clearInterval(id);
  }, [api, autoPlay, paused, images.length]);

  if (images.length === 0) {
    return (
      <div
        className={cn(
          "relative flex w-full items-center justify-center bg-muted text-muted-foreground",
          heightClass,
        )}
      >
        {fallback}
        {overlay}
      </div>
    );
  }
  if (images.length === 1) {
    return (
      <div className={cn("relative w-full overflow-hidden bg-muted", heightClass)}>
        <OptimizedImage src={images[0]} alt={alt ?? ""} className="h-full w-full object-cover" />
        {overlay}
      </div>
    );
  }
  const arrow = arrowSize === "lg" ? "h-8 w-8" : "h-7 w-7";
  return (
    <Carousel
      opts={{ loop: true }}
      setApi={setApi}
      className="relative w-full overflow-hidden bg-muted"
      onMouseEnter={autoPlay ? () => setPaused(true) : undefined}
      onMouseLeave={autoPlay ? () => setPaused(false) : undefined}
    >
      <CarouselContent className={cn("ml-0", heightClass)}>
        {images.map((src, i) => (
          <CarouselItem key={i} className={cn("pl-0", heightClass)}>
            <OptimizedImage src={src} alt={alt ?? ""} className="h-full w-full object-cover" />
          </CarouselItem>
        ))}
      </CarouselContent>
      {controls === "arrows" && (
        <>
          <CarouselPrevious
            className={cn(
              "absolute left-2 top-1/2 -translate-y-1/2 border-0 bg-black/50 text-white hover:bg-black/70 hover:text-white",
              arrow,
            )}
          />
          <CarouselNext
            className={cn(
              "absolute right-2 top-1/2 -translate-y-1/2 border-0 bg-black/50 text-white hover:bg-black/70 hover:text-white",
              arrow,
            )}
          />
        </>
      )}
      <span className="pointer-events-none absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-medium text-white">
        <Images className="h-3 w-3" />
        {images.length}
      </span>
      {overlay}
    </Carousel>
  );
}
