import { useT } from "@/hooks/useT";
import type { I18n } from "@/types/site-schema";
import { GalleryGrid, type GalleryImage } from "@/components/media/GalleryGrid";

/**
 * Galerie d'images d'un article (POI `type=article`) — documents `contentKey="slider"` fusionnés dans
 * `article.images` par `about` (chantier 2 backend, URLs déjà absolues via `_imageFields` de la lib).
 * Affichage seul (grille + lightbox partagés via `GalleryGrid`). Rien si aucune image slider.
 */
const TITLE: I18n = { fr: "Galerie", en: "Gallery" };

export function ArticleGallery({ images, className }: { images?: unknown; className?: string }) {
  const t = useT("modules/blog");
  const gallery = (Array.isArray(images) ? (images as GalleryImage[]) : []).filter(
    (im) => im?.contentKey === "slider" && (im.imagePath || im.imageThumbPath),
  );
  if (gallery.length === 0) return null;

  return (
    <section className={className}>
      <h2 className="mb-4 text-xl font-bold text-foreground">{t(TITLE)}</h2>
      <GalleryGrid images={gallery} />
    </section>
  );
}
