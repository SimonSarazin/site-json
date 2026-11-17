import { useCallback, useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocalization } from "@/hooks/useLocalization";
import { GallerySectionProps } from "@/types/site-schema";
import { OptimizedImage } from "@/components/ui/OptimizedImage";

/* ---------- Composant ---------- */
export function GallerySection({ id, props }: { id?: string; props: GallerySectionProps }) {
  const { images, columns = 3, lightbox = true } = props;
  const layout = props.layout ?? "grid";
  const { t } = useLocalization();
  const [selected, setSelected] = useState<number | null>(null);
  const [index, setIndex] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);

  const goTo = useCallback((next: number) => {
    const track = trackRef.current;
    if (!track || track.children.length === 0) return;
    const target = (next + track.children.length) % track.children.length;
    const slide = track.children.item(target) as HTMLElement | null;
    if (!slide) return;
    track.scrollTo({
      left: slide.offsetLeft,
      behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ? "auto" : "smooth",
    });
  }, []);

  useEffect(() => {
    if (layout !== "carousel") return;
    const track = trackRef.current;
    if (!track) return;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const slides = Array.from(track.children) as HTMLElement[];
        const nearest = slides.reduce(
          (best, slide, i) =>
            Math.abs(slide.offsetLeft - track.scrollLeft) <
            Math.abs(slides[best].offsetLeft - track.scrollLeft)
              ? i
              : best,
          0
        );
        setIndex(nearest);
      });
    };
    track.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      track.removeEventListener("scroll", onScroll);
    };
  }, [layout]);

  /* --- helper : cols → classes --- */
  const gridCols = (c: number) =>
    (
      {
        1: "grid-cols-1",
        2: "grid-cols-1 md:grid-cols-2",
        3: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
        4: "grid-cols-1 md:grid-cols-2 lg:grid-cols-4",
        5: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5",
        6: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6",
      } as const
    )[c] ?? "grid-cols-1";
  const carouselCols = (c: number) =>
    (
      {
        1: "w-full",
        2: "w-full md:w-[calc((100%-1rem)/2)]",
        3: "w-full md:w-[calc((100%-1rem)/2)] lg:w-[calc((100%-2rem)/3)]",
        4: "w-full md:w-[calc((100%-1rem)/2)] lg:w-[calc((100%-3rem)/4)]",
        5: "w-full md:w-[calc((100%-1rem)/2)] lg:w-[calc((100%-2rem)/3)] xl:w-[calc((100%-4rem)/5)]",
        6: "w-full md:w-[calc((100%-1rem)/2)] lg:w-[calc((100%-2rem)/3)] xl:w-[calc((100%-5rem)/6)]",
      } as const
    )[c] ?? "w-full";

  /* --- navigation --- */
  const next = () =>
    setSelected((i) => (i !== null ? (i + 1) % images.length : 0));
  const prev = () =>
    setSelected((i) => (i !== null ? (i - 1 + images.length) % images.length : 0));

  /* --- carte image --- */
  const ImageCard = ({
    image,
    index,
  }: {
    image: GallerySectionProps["images"][number];
    index: number;
  }) => {
    const alt = image.alt
      ? t(image.alt)
      : t({ fr: `Image ${index + 1}`, en: `Image ${index + 1}` });

    const card = (
      <div className={cn("group relative overflow-hidden cursor-pointer", layout === "grid" && "rounded-lg")}>
        <AspectRatio ratio={layout === "carousel" ? 2.4 : 1}>
          <OptimizedImage
            src={image.src}
            alt={alt}
            width={layout === "carousel" ? 800 : 400}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        </AspectRatio>

        {/* overlay au survol */}
        <div className="absolute inset-0 bg-muted/0 transition-colors duration-300 group-hover:bg-muted/20" />

        {/* légende */}
        {image.caption && (
          <p className="absolute bottom-0 w-full bg-background/70 px-4 py-2 text-sm text-muted-foreground backdrop-blur-sm">
            {t(image.caption)}
          </p>
        )}
      </div>
    );

    return lightbox ? (
      <button
        key={index}
        type="button"
        className="w-full focus-visible:outline-none"
        onClick={() => setSelected(index)}
      >
        {card}
      </button>
    ) : (
      <div key={index} className="w-full">{card}</div>
    );
  };

  const current = selected !== null ? images[selected] : null;
  const lightboxDialog = lightbox && current && (
    <Dialog
      open={selected !== null}
      onOpenChange={(open) => !open && setSelected(null)}
    >
      <DialogContent className="w-auto p-0 max-h-[90vh] sm:max-w-[90vw] sm:max-h-[90vh]">
        <DialogTitle className="sr-only">
          {t({ fr: "Galerie d’images", en: "Image gallery" })}
        </DialogTitle>
        <div className="relative flex w-full items-center justify-center bg-background">
          {images.length > 1 && (
            <>
              <Button
                variant="ghost"
                size="icon"
                aria-label={t({ fr: "Image précédente", en: "Previous image" })}
                className="absolute left-4 top-1/2 -translate-y-1/2"
                onClick={prev}
              >
                <ChevronLeft className="size-6" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={t({ fr: "Image suivante", en: "Next image" })}
                className="absolute right-4 top-1/2 -translate-y-1/2"
                onClick={next}
              >
                <ChevronRight className="size-6" />
              </Button>
            </>
          )}
          <OptimizedImage
            src={current.src}
            alt={current.alt ? t(current.alt) : ""}
            width={1200}
            className="h-auto w-auto max-h-[90vh] max-w-full object-contain"
          />
          {current.caption && (
            <p className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-md bg-background/70 px-4 py-2 text-sm text-muted-foreground backdrop-blur-sm">
              {t(current.caption)}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );

  /* ---------- render ---------- */
  if (layout === "carousel") {
    return (
      <section
        id={id}
        className="bg-background py-4 text-foreground"
        aria-roledescription="carousel"
        aria-label={t({ fr: "Galerie de photos", en: "Photo gallery" })}
      >
        <div className="relative w-full px-4 sm:px-6">
          <div
            ref={trackRef}
            className="flex snap-x snap-mandatory gap-4 overflow-x-auto overflow-y-hidden scrollbar-hide"
            aria-live="polite"
            aria-atomic="false"
          >
            {images.map((image, i) => (
              <div
                key={i}
                role="group"
                aria-roledescription="slide"
                aria-label={t({
                  fr: `Image ${i + 1} sur ${images.length}`,
                  en: `Image ${i + 1} of ${images.length}`,
                })}
                className={cn("shrink-0 snap-start", carouselCols(columns))}
              >
                <ImageCard image={image} index={i} />
              </div>
            ))}
          </div>

          {images.length > 1 && (
            <>
              <Button
                variant="ghost"
                size="icon"
                aria-label={t({ fr: "Image précédente", en: "Previous image" })}
                className="absolute left-2 top-1/2 z-10 -translate-y-1/2 text-primary hover:bg-background/60"
                onClick={() => goTo(index - 1)}
              >
                <ChevronLeft className="size-8" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={t({ fr: "Image suivante", en: "Next image" })}
                className="absolute right-2 top-1/2 z-10 -translate-y-1/2 text-primary hover:bg-background/60"
                onClick={() => goTo(index + 1)}
              >
                <ChevronRight className="size-8" />
              </Button>
              <div className="mt-3 flex justify-center gap-2">
                {images.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    aria-label={t({
                      fr: `Afficher l’image ${i + 1}`,
                      en: `Show image ${i + 1}`,
                    })}
                    aria-current={i === index ? "true" : undefined}
                    onClick={() => goTo(i)}
                    className={cn(
                      "size-2 rounded-full transition-colors",
                      i === index ? "bg-primary" : "bg-muted-foreground/40"
                    )}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        {lightboxDialog}
      </section>
    );
  }

  return (
    <section id={id} className="py-16 bg-background text-foreground">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Grille */}
        <div className={cn("grid gap-4", gridCols(columns))}>
          {images.map((img, i) => (
            <ImageCard key={i} image={img} index={i} />
          ))}
        </div>

        {lightboxDialog}
      </div>
    </section>
  );
}

export default GallerySection;
