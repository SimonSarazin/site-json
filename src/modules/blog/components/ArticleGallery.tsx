import { useState } from "react";
import { ImageViewer } from "@/components/ui/image-viewer";
import { useT } from "@/hooks/useT";
import type { I18n } from "@/types/site-schema";

/**
 * Galerie d'images d'un article (POI `type=article`) — documents `contentKey="slider"` fusionnés dans
 * `article.images` par `about` (chantier 2 backend). Les URLs sont DÉJÀ absolues (normalisées par
 * `_imageFields`/`_ensureFullURL` de la lib) → pas de préfixe ici. Grille responsive + lightbox
 * (`ImageViewer`, interaction client). Ne rend rien si aucune image slider.
 */
interface GalleryImage {
  id?: string;
  contentKey?: string;
  imagePath?: string;
  imageThumbPath?: string;
  imageMediumPath?: string;
  name?: string;
}

const TITLE: I18n = { fr: "Galerie", en: "Gallery" };

export function ArticleGallery({ images, className }: { images?: unknown; className?: string }) {
  const t = useT("modules/blog");
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  const gallery = (Array.isArray(images) ? (images as GalleryImage[]) : []).filter(
    (im) => im?.contentKey === "slider" && (im.imagePath || im.imageThumbPath),
  );
  if (gallery.length === 0) return null;

  return (
    <section className={className}>
      <h2 className="mb-4 text-xl font-bold text-foreground">{t(TITLE)}</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {gallery.map((im, i) => (
          <button
            key={im.id ?? i}
            type="button"
            onClick={() => setViewerIndex(i)}
            className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label={im.name || `Image ${i + 1}`}
          >
            <img
              src={im.imageThumbPath || im.imagePath}
              alt={im.name || ""}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          </button>
        ))}
      </div>
      <ImageViewer
        images={gallery.map((im) => ({ src: (im.imagePath || im.imageMediumPath) as string, name: im.name }))}
        initialIndex={viewerIndex ?? 0}
        open={viewerIndex !== null}
        onClose={() => setViewerIndex(null)}
      />
    </section>
  );
}
