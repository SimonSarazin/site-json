import { useState } from "react";
import { ImageIcon, X } from "lucide-react";
import { Modal, ModalContent, ModalTitle } from "@/components/ui/modal";
import type { NewsImageItem } from "../../types";
import { OptimizedImage } from "@/components/ui/OptimizedImage";
import { cn } from "@/lib/utils";

interface NewsImageGridProps {
  images: NewsImageItem[];
}

/**
 * Grille d'images d'une news, en COLLAGE type réseau social (1/2/3/4/5+), à ratio constant
 * plutôt qu'en hauteurs fixes de 200px : une image = héro 16/10 ; deux = côte à côte ; trois =
 * une grande + deux empilées (plus de colonne vide) ; quatre = 2×2 ; cinq et plus = 2×2 avec
 * surcouche « +N » sur la dernière tuile. Clic → lightbox (voir plus bas).
 */
export function NewsImageGrid({ images }: NewsImageGridProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const count = images.length;

  // Rend UNE tuile (image + survol + éventuelle surcouche « +N »). Fonction (pas composant)
  // → pas de remontage au changement de `selectedImage`.
  const renderTile = (img: NewsImageItem, index: number, className?: string, overlayCount?: number) => {
    const imagePath = img.imagePath || img.imageThumbPath;
    return (
      <div
        key={img.id || img._id?._str || index}
        className={cn("group relative cursor-pointer overflow-hidden bg-muted", className)}
        onClick={() => imagePath && setSelectedImage(imagePath)}
      >
        {imagePath ? (
          <>
            <OptimizedImage
              src={imagePath}
              alt={img.name || `Image ${index + 1}`}
              width={600}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
            <div className="absolute inset-0 transition-colors duration-300 group-hover:bg-black/10" />
            {overlayCount ? (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                <span className="text-2xl font-bold text-white">+{overlayCount}</span>
              </div>
            ) : null}
          </>
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground transition-colors group-hover:text-primary">
            <ImageIcon className="h-10 w-10" />
          </div>
        )}
      </div>
    );
  };

  if (count === 0) return null;

  return (
    <>
      <div className="px-6 pb-4">
        <div className="overflow-hidden rounded-lg">
          {count === 1 && (
            <div className="aspect-[16/10]">
              {renderTile(images[0], 0, "h-full w-full")}
            </div>
          )}

          {count === 2 && (
            <div className="grid aspect-[2/1] grid-cols-2 gap-1">
              {images.slice(0, 2).map((img, i) => renderTile(img, i))}
            </div>
          )}

          {count === 3 && (
            <div className="grid aspect-[3/2] grid-cols-2 grid-rows-2 gap-1">
              {renderTile(images[0], 0, "row-span-2")}
              {renderTile(images[1], 1)}
              {renderTile(images[2], 2)}
            </div>
          )}

          {count >= 4 && (
            <div className="grid aspect-square grid-cols-2 grid-rows-2 gap-1">
              {images.slice(0, 4).map((img, i) =>
                renderTile(img, i, undefined, i === 3 && count > 4 ? count - 4 : undefined)
              )}
            </div>
          )}
        </div>
      </div>

      <Modal open={!!selectedImage} onOpenChange={(open) => !open && setSelectedImage(null)}>
        {/* `w-fit` : la coque s'ajuste à l'image → centrage réel (sinon `w-full`=95vw et l'image
            `object-contain` se colle à gauche). La croix est ancrée au VIEWPORT (`fixed`) pour
            rester visible même sur une image plein écran (l'ancien `-top-12` sortait par le haut). */}
        <ModalContent aria-describedby={undefined} className="w-fit max-w-[95vw] max-h-[95vh] p-0 border-0 bg-transparent shadow-none">
          {/* Titre requis par Radix pour l'accessibilité (lecteur d'écran), masqué visuellement. */}
          <ModalTitle className="sr-only">Image agrandie</ModalTitle>
          <button
            onClick={() => setSelectedImage(null)}
            className="fixed right-4 top-4 z-[60] rounded-full bg-black/60 p-2 text-white transition-colors hover:bg-black/80"
            aria-label="Fermer"
          >
            <X className="h-6 w-6" />
          </button>
          {selectedImage && (
            <OptimizedImage
              src={selectedImage}
              alt="Image agrandie"
              width={1200}
              className="max-h-[90vh] w-auto max-w-[95vw] object-contain rounded-lg shadow-2xl"
            />
          )}
        </ModalContent>
      </Modal>
    </>
  );
}
