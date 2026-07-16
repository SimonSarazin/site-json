import { useState } from "react";
import { X, ImagePlus } from "lucide-react";
import { ImageViewer } from "@/components/ui/image-viewer";

/** Forme `getListOfImage` (lib) — URLs DÉJÀ absolues (normalisées par `_imageFields`/`_ensureFullURL`). */
export interface GalleryImage {
  id?: string;
  contentKey?: string;
  imagePath?: string;
  imageThumbPath?: string;
  imageMediumPath?: string;
  name?: string;
}

interface GalleryGridProps {
  images: GalleryImage[];
  /** Gestion (admin) : suppression par vignette. Absent = affichage seul. */
  onDelete?: (image: GalleryImage) => void;
  /** Gestion (admin) : tuile d'ajout. */
  onAddClick?: () => void;
  /** docId en cours de suppression (vignette désactivée). */
  deletingId?: string | null;
  className?: string;
}

/**
 * Grille d'images responsive + lightbox (`ImageViewer`). Affichage seul par défaut ; passer
 * `onDelete`/`onAddClick` active la gestion inline (croix par vignette + tuile d'ajout). Partagé par
 * la galerie d'article (blog) et la galerie de profil (entités normales). URLs attendues ABSOLUES.
 */
export function GalleryGrid({ images, onDelete, onAddClick, deletingId, className }: GalleryGridProps) {
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  if (images.length === 0 && !onAddClick) return null;

  return (
    <div className={className}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {images.map((im, i) => (
          <div key={im.id ?? i} className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-muted">
            <button
              type="button"
              onClick={() => setViewerIndex(i)}
              className="block h-full w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              aria-label={im.name || `Image ${i + 1}`}
            >
              <img
                src={im.imageThumbPath || im.imagePath}
                alt={im.name || ""}
                loading="lazy"
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
            </button>
            {onDelete && (
              <button
                type="button"
                onClick={() => onDelete(im)}
                disabled={!!deletingId && deletingId === im.id}
                className="absolute right-1 top-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-background/80 opacity-0 shadow transition group-hover:opacity-100 hover:bg-destructive hover:text-destructive-foreground disabled:opacity-50"
                aria-label="Supprimer l'image"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ))}
        {onAddClick && (
          <button
            type="button"
            onClick={onAddClick}
            className="flex aspect-square items-center justify-center rounded-lg border-2 border-dashed border-border text-muted-foreground transition-colors hover:border-primary hover:text-primary"
            aria-label="Ajouter des images"
          >
            <ImagePlus className="h-6 w-6" />
          </button>
        )}
      </div>
      <ImageViewer
        images={images.map((im) => ({ src: (im.imagePath || im.imageMediumPath) as string, name: im.name }))}
        initialIndex={viewerIndex ?? 0}
        open={viewerIndex !== null}
        onClose={() => setViewerIndex(null)}
      />
    </div>
  );
}
