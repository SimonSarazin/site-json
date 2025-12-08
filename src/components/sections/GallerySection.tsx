import { useState } from "react";
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

/* ---------- Composant ---------- */
export function GallerySection({ id, props }: { id?: string; props: GallerySectionProps }) {
  const { images, columns = 3, lightbox = true } = props;
  const { t } = useLocalization();
  const [selected, setSelected] = useState<number | null>(null);

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
      <div className="group relative overflow-hidden rounded-lg cursor-pointer">
        <AspectRatio ratio={1}>
          <img
            src={image.src}
            alt={alt}
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
        className="focus-visible:outline-none"
        onClick={() => setSelected(index)}
      >
        {card}
      </button>
    ) : (
      <div key={index}>{card}</div>
    );
  };

  const current = selected !== null ? images[selected] : null;

  /* ---------- render ---------- */
  return (
    <section id={id} className="py-16 bg-background text-foreground">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Grille */}
        <div className={cn("grid gap-4", gridCols(columns))}>
          {images.map((img, i) => (
            <ImageCard key={i} image={img} index={i} />
          ))}
        </div>

        {/* Lightbox */}
        {lightbox && current && (
          <Dialog
            open={selected !== null}
            onOpenChange={(open) => !open && setSelected(null)}
          >
            <DialogContent className="w-auto p-0 max-h-[90vh] sm:max-w-[90vw] sm:max-h-[90vh]">
                <DialogTitle className="sr-only">
                  {t({ fr: "Galerie d’images", en: "Image gallery" })}
                </DialogTitle>


              <div className="relative flex w-full items-center justify-center bg-background">
                {/* Précédent / suivant */}
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

                {/* Image */}
                <img
                  src={current.src}
                  alt={current.alt ? t(current.alt) : ""}
                  className="h-auto w-auto max-h-[90vh] max-w-full object-contain"
                />

                {/* Légende */}
                {current.caption && (
                  <p className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-md bg-background/70 px-4 py-2 text-sm text-muted-foreground backdrop-blur-sm">
                    {t(current.caption)}
                  </p>
                )}
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </section>
  );
}

export default GallerySection;
